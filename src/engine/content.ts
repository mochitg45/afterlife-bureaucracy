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
});

export type UpgradeEffect = z.infer<typeof upgradeEffectSchema>;
export type StaffDef = z.infer<typeof staffSchema>;
export type UpgradeDef = z.infer<typeof upgradeSchema>;
export type DepartmentDef = z.infer<typeof departmentSchema>;
export interface Content { departments: DepartmentDef[] }

function assertUnique(ids: string[], label: string) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function loadContent(raw: unknown[]): Content {
  const departments = raw.map((r) => departmentSchema.parse(r));
  assertUnique(departments.map((d) => d.id), 'department');
  assertUnique(departments.flatMap((d) => d.staff.map((s) => s.id)), 'staff');
  assertUnique(departments.flatMap((d) => d.upgrades.map((u) => u.id)), 'upgrade');
  return { departments };
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
