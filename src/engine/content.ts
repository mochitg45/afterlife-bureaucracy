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
  /**
   * A Cosmic branch this department belongs to. Branch departments stay invisible — out of
   * the starting set and out of unlockDepartments — until a Clause puts the branch in
   * `branchesUnlocked`, however many souls the player has earned.
   */
  branch: z.string().min(1).optional(),
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

const clauseEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('globalMult'), value: z.number().positive() }),
  z.object({ type: z.literal('sealMult'), value: z.number().positive() }),
  z.object({ type: z.literal('offlineCapHours'), value: z.number().positive() }),
  z.object({ type: z.literal('unlockBranch'), branch: z.string().min(1) }),
  z.object({ type: z.literal('voucherMult'), value: z.number().positive() }),
]);

const clauseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  desc: z.string(),
  requires: z.array(z.string().min(1)),
  effect: clauseEffectSchema,
});

const cardEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('deptMult'), dept: z.string().min(1), value: z.number().positive() }),
  z.object({ type: z.literal('globalMult'), value: z.number().positive() }),
  z.object({ type: z.literal('clickMult'), value: z.number().positive() }),
  z.object({ type: z.literal('offlineCapHours'), value: z.number().positive() }),
  z.object({ type: z.literal('voucherMult'), value: z.number().positive() }),
  /** More event currency in every event, from an equipped card; scaled by stars like the rest. */
  z.object({ type: z.literal('eventMult'), value: z.number().positive() }),
]);

const cardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().min(1),
  rarity: z.enum(['temp', 'fulltime', 'senior', 'executive']),
  dept: z.string().min(1),
  character: z.string().min(1),
  effect: cardEffectSchema,
  flavor: z.string(),
  /** Set on a card that only its own special event can give (id of that special). */
  event: z.string().min(1).optional(),
});

const mmdd = z.string().regex(/^\d{2}-\d{2}$/);

const eventRewardSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('vouchers'), amount: z.number().int().positive() }),
  z.object({ type: z.literal('seals'), amount: z.number().int().positive() }),
  z.object({ type: z.literal('card'), card: z.string().min(1) }),
]);

const eventTierSchema = z.object({ at: z.number().positive(), reward: eventRewardSchema });

const eventCommon = {
  currency: z.string().min(1),
  deptName: z.string().min(1),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  staff: z.array(staffSchema).min(1),
  track: z.array(eventTierSchema).min(1),
};

const weeklySchema = z.object({
  ...eventCommon,
  themes: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    blurb: z.string(),
    /** The week's look for each base staff, by position: same ids, costs and rates, new faces. */
    staff: z.array(z.object({ name: z.string().min(1), role: z.string(), flavor: z.string(), character: z.string().min(1) })).optional(),
  })).min(1),
});

const specialSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  blurb: z.string(),
  window: z.discriminatedUnion('type', [
    z.object({ type: z.literal('fixed'), start: mmdd, end: mmdd }),
    z.object({ type: z.literal('easter'), before: z.number().int().nonnegative(), after: z.number().int().positive() }),
  ]),
  ...eventCommon,
  banner: z.object({ name: z.string().min(1), featured: z.string().min(1) }),
});

const eventsSchema = z.object({ weekly: weeklySchema, specials: z.array(specialSchema) });

const dailySchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['clicks', 'hire', 'upgrades', 'equip', 'audit', 'perk', 'pulls', 'rate', 'ad']),
    target: z.number().int().positive(),
    text: z.string().min(1),
  })
  .refine((d) => d.text.includes('{n}'), { message: '{n} placeholder required' });

const achievementConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('soulsLifetime'), target: z.number().positive() }),
  z.object({ type: z.literal('clicks'), target: z.number().positive() }),
  z.object({ type: z.literal('staffHired'), target: z.number().positive() }),
  z.object({ type: z.literal('upgradesBought'), target: z.number().positive() }),
  z.object({ type: z.literal('audits'), target: z.number().positive() }),
  z.object({ type: z.literal('pulls'), target: z.number().positive() }),
  z.object({ type: z.literal('dailiesClaimed'), target: z.number().positive() }),
  z.object({ type: z.literal('adsWatched'), target: z.number().positive() }),
  z.object({ type: z.literal('bestStreak'), target: z.number().positive() }),
  z.object({ type: z.literal('seals'), target: z.number().positive() }),
  z.object({ type: z.literal('fiscalYear'), target: z.number().positive() }),
  z.object({ type: z.literal('cardsOwned'), target: z.number().positive() }),
  z.object({ type: z.literal('executivesOwned'), target: z.number().positive() }),
  z.object({ type: z.literal('fiveStarCards'), target: z.number().positive() }),
  z.object({ type: z.literal('perksOwned'), target: z.number().positive() }),
  z.object({ type: z.literal('departmentsUnlocked'), target: z.number().positive() }),
  z.object({ type: z.literal('equipped'), target: z.number().positive() }),
  z.object({ type: z.literal('staffOwned'), staff: z.string().min(1), target: z.number().positive() }),
]);

const achievementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  desc: z.string(),
  badge: z.enum(['stamp', 'trophy', 'star', 'scroll', 'flame', 'gear']),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  condition: achievementConditionSchema,
  vouchers: z.number().int().nonnegative().optional(),
});

const storyTriggerSchema = z.object({
  type: z.enum(['soulsLifetime', 'audits', 'departmentsUnlocked', 'cardsOwned', 'fiscalYear', 'bestStreak']),
  target: z.number().positive(),
});

const storySchema = z.object({
  id: z.string().min(1),
  trigger: storyTriggerSchema,
  title: z.string().min(1),
  text: z.string().min(1),
});

/**
 * The story memo house rule: three sentences is as much prose as a parchment overlay gets
 * before the player starts skipping it. Counted the way `content.test.ts` counts a story
 * beat — a terminator, optional closing quote or bracket, then whitespace.
 */
const SENTENCE_BREAK = /[.!?]+['")\]]*\s/;
function atMostThreeSentences(text: string): boolean {
  return text.trim().split(SENTENCE_BREAK).length <= 3;
}

/**
 * One frame of the opening cutscene. `caption` may carry its form number ahead of an em
 * dash — the overlay sets that half in the typewriter face — and `cta` labels the button;
 * scenes without one just say Next.
 */
const introSceneSchema = z.object({
  id: z.string().min(1),
  caption: z.string().min(1).refine(atMostThreeSentences, { message: 'Intro caption must be at most three sentences' }),
  cta: z.string().min(1).optional(),
});

/** `target` names the `[data-coach]` attribute the coach mark spotlights; `none` centres the card. */
const trainingStepSchema = z.object({
  step: z.number().int().nonnegative(),
  target: z.enum(['stamp', 'hire', 'none']),
  title: z.string().min(1),
  text: z.string().min(1),
});

/** The beginner tips, in the order the tips overlay considers them. */
export const TIP_IDS = [
  'speed-bar', 'staff-milestone', 'buy-mode', 'upgrades', 'offline', 'dept-unlock',
  'personnel-intro', 'equip', 'stars', 'tasks-intro', 'ledger-intro',
] as const;
export type TipId = (typeof TIP_IDS)[number];

/**
 * A one-time beginner tip. `target` names a `[data-coach]` attribute like a training step's,
 * or `none` to centre the card; `{name}` placeholders in `text` are filled in by the overlay.
 */
const tipSchema = z.object({
  id: z.enum(TIP_IDS),
  target: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
});

const onboardingSchema = z.object({
  /** Four scenes exactly: the intro overlay is a written cutscene, not a variable slideshow. */
  intro: z.array(introSceneSchema).length(4),
  training: z.array(trainingStepSchema).min(1),
  tips: z.array(tipSchema).default([]),
});

export type UpgradeEffect = z.infer<typeof upgradeEffectSchema>;
export type StaffDef = z.infer<typeof staffSchema>;
export type UpgradeDef = z.infer<typeof upgradeSchema>;
export type DepartmentDef = z.infer<typeof departmentSchema>;
export type PerkEffect = z.infer<typeof perkEffectSchema>;
export type PerkDef = z.infer<typeof perkSchema>;
export type PerkBranch = PerkDef['branch'];
export type ClauseEffect = z.infer<typeof clauseEffectSchema>;
export type ClauseDef = z.infer<typeof clauseSchema>;
export type CardEffect = z.infer<typeof cardEffectSchema>;
export type CardDef = z.infer<typeof cardSchema>;
export type Rarity = CardDef['rarity'];
export type EventTier = z.infer<typeof eventTierSchema>;
export type EventReward = z.infer<typeof eventRewardSchema>;
export type WeeklyDef = z.infer<typeof weeklySchema>;
export type SpecialDef = z.infer<typeof specialSchema>;
export interface EventsContent { weekly: WeeklyDef | null; specials: SpecialDef[] }
export type DailyDef = z.infer<typeof dailySchema>;
export type DailyKind = DailyDef['kind'];
export type AchievementCondition = z.infer<typeof achievementConditionSchema>;
export type AchievementDef = z.infer<typeof achievementSchema>;
export type StoryTrigger = z.infer<typeof storyTriggerSchema>;
export type StoryDef = z.infer<typeof storySchema>;
export type IntroSceneDef = z.infer<typeof introSceneSchema>;
export type TrainingStepDef = z.infer<typeof trainingStepSchema>;
export type CoachTarget = TrainingStepDef['target'];
export type TipDef = z.infer<typeof tipSchema>;
export type OnboardingContent = z.infer<typeof onboardingSchema>;
export interface Content {
  departments: DepartmentDef[];
  perks: PerkDef[];
  clauses: ClauseDef[];
  cards: CardDef[];
  dailies: DailyDef[];
  achievements: AchievementDef[];
  story: StoryDef[];
  onboarding: OnboardingContent;
  events: EventsContent;
}
export interface ContentExtras {
  events?: unknown;
  clauses?: unknown[];
  cards?: unknown[];
  dailies?: unknown[];
  achievements?: unknown[];
  story?: unknown[];
  onboarding?: unknown;
}

/** Daily kinds every player can make progress on from the first minute, whatever they own. */
export const ALWAYS_AVAILABLE_DAILY_KINDS: DailyKind[] = ['clicks', 'hire', 'upgrades', 'rate'];
/** pickTasks needs one ungated kind per task it draws. */
const MIN_ALWAYS_AVAILABLE_KINDS = 3;

function assertUnique(ids: string[], label: string) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function loadContent(rawDepartments: unknown[], rawPerks: unknown[] = [], extras: ContentExtras = {}): Content {
  const departments = rawDepartments.map((r) => departmentSchema.parse(r));
  assertUnique(departments.map((d) => d.id), 'department');
  assertUnique(departments.flatMap((d) => d.staff.map((s) => s.id)), 'staff');
  assertUnique(departments.flatMap((d) => d.upgrades.map((u) => u.id)), 'upgrade');
  // createInitialState() and resetRun() both open with the free departments; without one
  // the player would boot into an office that does not exist.
  if (!departments.some((d) => d.unlockSouls === 0 && !d.branch)) {
    throw new Error('Content has no starting department: at least one branch-free department needs unlockSouls 0');
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

  const clauses = (extras.clauses ?? []).map((r) => clauseSchema.parse(r));
  assertUnique(clauses.map((c) => c.id), 'clause');
  const clauseIds = new Set(clauses.map((c) => c.id));
  // A branch nobody declares would be a Clause the player can buy that opens nothing.
  const branches = new Set(departments.map((d) => d.branch).filter((b): b is string => !!b));
  for (const c of clauses) {
    for (const req of c.requires) {
      if (!clauseIds.has(req)) throw new Error(`Unknown clause prerequisite ${req} on ${c.id}`);
    }
    if (c.effect.type === 'unlockBranch' && !branches.has(c.effect.branch)) {
      throw new Error(`Unknown branch ${c.effect.branch} on clause ${c.id}`);
    }
  }

  const cards = (extras.cards ?? []).map((r) => cardSchema.parse(r));
  assertUnique(cards.map((c) => c.id), 'card');
  for (const c of cards) {
    if (!deptIds.has(c.dept)) throw new Error(`Unknown department ${c.dept} on card ${c.id}`);
  }
  // The gacha's rollRarity picks a rarity first, then a card from that rarity's pool; a rarity
  // with zero cards would leave that pool empty for every pull that rolls it.
  // Event cards never drop from it, so the check is over the cards the normal banner can give.
  const RARITIES: CardDef['rarity'][] = ['temp', 'fulltime', 'senior', 'executive'];
  if (cards.length > 0) {
    for (const rarity of RARITIES) {
      if (!cards.some((c) => c.rarity === rarity && !c.event)) throw new Error(`Content has no ${rarity} cards`);
    }
  }

  const events: EventsContent =
    extras.events === undefined ? { weekly: null, specials: [] } : eventsSchema.parse(extras.events);
  assertUnique(events.specials.map((e) => e.id), 'event');
  const eventStaff = [...(events.weekly?.staff ?? []), ...events.specials.flatMap((e) => e.staff)];
  assertUnique([...departments.flatMap((d) => d.staff.map((s) => s.id)), ...eventStaff.map((s) => s.id)], 'staff');
  const specialIds = new Set(events.specials.map((e) => e.id));
  for (const c of cards) {
    if (c.event && !specialIds.has(c.event)) throw new Error(`Unknown event ${c.event} on card ${c.id}`);
  }
  for (const e of events.specials) {
    const mine = cards.filter((c) => c.event === e.id);
    // The event banner rolls a rarity, then takes this event's one card of it.
    for (const rarity of RARITIES) {
      if (mine.filter((c) => c.rarity === rarity).length !== 1) {
        throw new Error(`Event ${e.id} needs exactly one ${rarity} card`);
      }
    }
    const refs = [e.banner.featured, ...e.track.flatMap((t) => (t.reward.type === 'card' ? [t.reward.card] : []))];
    for (const ref of refs) {
      if (!mine.some((c) => c.id === ref)) throw new Error(`Event ${e.id} references card ${ref} that is not its own`);
    }
  }

  const dailies = (extras.dailies ?? []).map((r) => dailySchema.parse(r));
  assertUnique(dailies.map((d) => d.id), 'daily');
  // pickTasks draws TASKS_PER_DAY tasks of distinct kinds from the kinds the player can
  // currently do; without enough ungated kinds a fresh save would be handed a short list.
  if (dailies.length > 0) {
    const covered = new Set(dailies.filter((d) => ALWAYS_AVAILABLE_DAILY_KINDS.includes(d.kind)).map((d) => d.kind));
    if (covered.size < MIN_ALWAYS_AVAILABLE_KINDS) {
      throw new Error(
        `Daily pool needs at least ${MIN_ALWAYS_AVAILABLE_KINDS} always-available kinds (${ALWAYS_AVAILABLE_DAILY_KINDS.join(', ')}), found ${covered.size}`,
      );
    }
  }

  const achievements = (extras.achievements ?? []).map((r) => achievementSchema.parse(r));
  assertUnique(achievements.map((a) => a.id), 'achievement');
  for (const a of achievements) {
    if (a.condition.type === 'staffOwned' && !staffIds.has(a.condition.staff)) {
      throw new Error(`Unknown staff ${a.condition.staff} on achievement ${a.id}`);
    }
  }

  const story = (extras.story ?? []).map((r) => storySchema.parse(r));
  assertUnique(story.map((s) => s.id), 'story');

  // A content set without onboarding is a valid one — most tests load a bare department —
  // so the absent case is an empty walkthrough rather than a parse error.
  const onboarding = extras.onboarding === undefined ? { intro: [], training: [], tips: [] } : onboardingSchema.parse(extras.onboarding);
  assertUnique(onboarding.intro.map((sc) => sc.id), 'intro scene');
  // Training() looks a step up by its number; two rows claiming step 1 would make which
  // card the player sees depend on array order.
  assertUnique(onboarding.training.map((t) => String(t.step)), 'training step');
  assertUnique(onboarding.tips.map((t) => t.id), 'tip');

  return { departments, perks, clauses, cards, dailies, achievements, story, onboarding, events };
}

export function findCard(content: Content, cardId: string): CardDef {
  const card = content.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  return card;
}

/** Non-throwing: a save can name a Clause this build no longer ships. */
export function findClause(content: Content, clauseId: string): ClauseDef | undefined {
  return content.clauses.find((c) => c.id === clauseId);
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
