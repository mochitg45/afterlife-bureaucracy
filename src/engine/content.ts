import { z } from 'zod';

const upgradeEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), value: z.number().positive() }),
  z.object({ type: z.literal('deptMult'), value: z.number().positive() }),
  z.object({ type: z.literal('offlineCapHours'), value: z.number().positive() }),
  z.object({ type: z.literal('offlineRate'), value: z.number().positive() }),
]);

const staffSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string(),
  flavor: z.string(),
  baseCost: z.number().positive(),
  baseRate: z.number().positive(),
  character: z.string().min(1),
});

const upgradeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  desc: z.string(),
  baseCost: z.number().positive(),
  costGrowth: z.number().min(1),
  maxLevel: z.number().int().positive(),
  effect: upgradeEffectSchema,
});

const departmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  unlockSouls: z.number().nonnegative(),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  staff: z.array(staffSchema).min(1),
  upgrades: z.array(upgradeSchema),
  queue: z.array(z.string()).min(1),
  memos: z.array(z.string()).min(1),
  memosLate: z.array(z.string()).optional(),
});

const perkEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('globalMult'), value: z.number().positive() }),
  z.object({ type: z.literal('deptMult'), dept: z.string().min(1), value: z.number().positive() }),
  z.object({ type: z.literal('offlineCapHours'), value: z.number().positive() }),
  z.object({ type: z.literal('offlineRate'), value: z.number().positive() }),
  z.object({ type: z.literal('click'), value: z.number().positive() }),
  z.object({ type: z.literal('voucherMult'), value: z.number().positive() }),
  z.object({ type: z.literal('equipSlots'), value: z.number().int().positive() }),
  z.object({ type: z.literal('headStartDept'), dept: z.string().min(1) }),
  z.object({ type: z.literal('headStartStaff'), staff: z.string().min(1), count: z.number().int().positive() }),
]);

const perkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  desc: z.string(),
  branch: z.enum(['throughput', 'overtime', 'stapler', 'requisition', 'headstart']),
  cost: z.number().int().positive(),
  requires: z.array(z.string().min(1)),
  effect: perkEffectSchema,
});

export type UpgradeEffect = z.infer<typeof upgradeEffectSchema>;
export type StaffDef = z.infer<typeof staffSchema>;
export type UpgradeDef = z.infer<typeof upgradeSchema>;
export type DepartmentDef = z.infer<typeof departmentSchema>;
export type PerkEffect = z.infer<typeof perkEffectSchema>;
export type PerkDef = z.infer<typeof perkSchema>;
export type PerkBranch = PerkDef['branch'];
export interface Content { departments: DepartmentDef[]; perks: PerkDef[] }

function assertUnique(ids: string[], label: string) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function loadContent(rawDepartments: unknown[], rawPerks: unknown[] = []): Content {
  const departments = rawDepartments.map((r) => departmentSchema.parse(r));
  assertUnique(departments.map((d) => d.id), 'department');
  assertUnique(departments.flatMap((d) => d.staff.map((s) => s.id)), 'staff');
  assertUnique(departments.flatMap((d) => d.upgrades.map((u) => u.id)), 'upgrade');
  // createInitialState() and resetRun() both open with the free departments; without one
  // the player would boot into an office that does not exist.
  if (!departments.some((d) => d.unlockSouls === 0)) {
    throw new Error('Content has no starting department: at least one department needs unlockSouls 0');
  }
  const perks = rawPerks.map((r) => perkSchema.parse(r));
  assertUnique(perks.map((p) => p.id), 'perk');
  const perkIds = new Set(perks.map((p) => p.id));
  const deptIds = new Set(departments.map((d) => d.id));
  const staffIds = new Set(departments.flatMap((d) => d.staff.map((s) => s.id)));
  for (const p of perks) {
    for (const req of p.requires) if (!perkIds.has(req)) throw new Error(`Unknown perk prerequisite ${req} on ${p.id}`);
    const e = p.effect;
    if ((e.type === 'deptMult' || e.type === 'headStartDept') && !deptIds.has(e.dept)) throw new Error(`Unknown department ${e.dept} on perk ${p.id}`);
    if (e.type === 'headStartStaff' && !staffIds.has(e.staff)) throw new Error(`Unknown staff ${e.staff} on perk ${p.id}`);
  }
  return { departments, perks };
}

export function findPerk(content: Content, perkId: string): PerkDef {
  const perk = content.perks.find((p) => p.id === perkId);
  if (!perk) throw new Error(`Unknown perk: ${perkId}`);
  return perk;
}

export function findDepartment(content: Content, deptId: string): DepartmentDef {
  const dept = content.departments.find((d) => d.id === deptId);
  if (!dept) throw new Error(`Unknown department: ${deptId}`);
  return dept;
}

export function findStaff(content: Content, staffId: string): { dept: DepartmentDef; staff: StaffDef } {
  for (const dept of content.departments) {
    const staff = dept.staff.find((s) => s.id === staffId);
    if (staff) return { dept, staff };
  }
  throw new Error(`Unknown staff: ${staffId}`);
}

export function findUpgrade(content: Content, upgradeId: string): { dept: DepartmentDef; upgrade: UpgradeDef } {
  for (const dept of content.departments) {
    const upgrade = dept.upgrades.find((u) => u.id === upgradeId);
    if (upgrade) return { dept, upgrade };
  }
  throw new Error(`Unknown upgrade: ${upgradeId}`);
}
