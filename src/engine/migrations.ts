export const SAVE_VERSION = 8;

type Raw = Record<string, unknown>;

/**
 * A per-save RNG seed derived from the one timestamp an old save always carries. A shared
 * constant would hand every migrating player the identical pull sequence.
 */
function seedFrom(lastSeenWallClock: unknown): number {
  const n = typeof lastSeenWallClock === 'number' && Number.isFinite(lastSeenWallClock) ? Math.floor(Math.abs(lastSeenWallClock)) : 0;
  return (n % 2147483647) || 1;
}

/**
 * Whether a pre-onboarding save had ever been played. `soulsLifetime` is a Decimal string on
 * a raw save, so it is read as text: anything that is not zero (or absent) counts.
 */
function hasProgress(raw: Raw): boolean {
  const souls = Number(raw.soulsLifetime);
  const clicks = Number((raw.stats as Raw | undefined)?.clicks);
  return (Number.isFinite(souls) && souls > 0) || (Number.isFinite(clicks) && clicks > 0);
}

// steps[v] upgrades a save from version v to v+1. Version 0 never shipped, so
// steps[0] is deliberately absent and such a save is rejected rather than wiped.
const steps: Array<((raw: Raw) => Raw) | undefined> = [
  undefined,
  // 1 -> 2: Overtime Boost deadlines moved from monotonic to wall-clock time.
  // The two are not comparable, so any in-flight boost is dropped.
  (raw) => {
    const out: Raw = { ...raw, boostUntilWall: 0 };
    delete out.boostUntil;
    return out;
  },
  // 2 -> 3: Perk Ledger purchases.
  (raw) => ({ ...raw, perks: [] }),
  // 3 -> 4: gacha cards, pity, daily tasks, achievements, story beats, notification
  // settings. firstSeenWallClock backfills from the last-seen timestamp we do have,
  // rather than "now", so a returning player's cohort isn't misdated.
  (raw) => ({
    ...raw,
    cards: {},
    equipped: [],
    pity: { senior: 0, executive: 0 },
    rngSeed: seedFrom(raw.lastSeenWallClock),
    dailies: {
      date: '',
      tasks: [],
      skipped: [],
      streak: 0,
      bestStreak: 0,
      skipTokens: 0,
      lastTokenDate: '',
      baseline: { clicks: 0, staffHired: 0, upgradesBought: 0, equips: 0, audits: 0, perksBought: 0, pulls: 0, adsWatched: 0 },
      completedToday: false,
      soulsPerSecSnapshot: '0',
    },
    achievements: [],
    storySeen: [],
    settings: { notifOptIn: 'unasked', notifDate: '', notifsSent: 0 },
    firstSeenWallClock: typeof raw.lastSeenWallClock === 'number' ? raw.lastSeenWallClock : 0,
    stats: { ...((raw.stats as object) ?? {}), pulls: 0, equips: 0, dailiesClaimed: 0, adsWatched: 0, perksBought: 0 },
  }),
  // 4 -> 5: the voucher faucet's carried remainder, the souls-per-second snapshot the
  // "reach N souls per second" daily reads, and the per-day notification budget.
  (raw) => ({
    ...raw,
    voucherFraction: 0,
    dailies: { ...((raw.dailies as object) ?? {}), soulsPerSecSnapshot: '0' },
    settings: { ...((raw.settings as object) ?? {}), notifDate: '', notifsSent: 0 },
  }),
  // 5 -> 6: monetization (entitlements, rewarded-ad bookkeeping), Cosmic Restructuring
  // and the per-process id the clock-integrity check reads. processId is left empty: the
  // process that wrote this save is long gone, so no same-process comparison is valid.
  (raw) => ({
    ...raw,
    entitlements: { removeAds: false, unionUntilWall: 0, starterPackBought: false },
    adState: { freePullDate: '', dailySkipDate: '', boostCooldownUntilWall: 0 },
    cosmicPoints: 0,
    cosmicClauses: [],
    branchesUnlocked: [],
    processId: '',
    stats: { ...((raw.stats as object) ?? {}), cosmics: 0, purchases: 0 },
  }),
  // 6 -> 7: first-launch onboarding progress, and the cloud-sync bookkeeping the title
  // screen and winner rule read. savedAtWall starts at 0: the store stamps it on the next
  // save() call, and an old save was never given a wall-clock save timestamp to backfill.
  //
  // A save that has already produced a soul or taken a click belongs to a player who has
  // been playing for versions: the opening memos and the three-step walkthrough are behind
  // them, so they are marked done rather than replayed at someone who knows the office.
  (raw) => {
    const started = hasProgress(raw);
    return {
      ...raw,
      onboarding: { memosSeen: started, trainingStep: started ? 3 : 0 },
      cloud: { lastSyncWall: 0, lastResult: 'none' },
      savedAtWall: 0,
    };
  },
  // 7 -> 8 (Playtest round 1): every voucher amount in the game was scaled ×10 so the
  // numbers read as a currency. Only the stored balance is scaled so an existing tester's
  // balance keeps its value under the new prices; voucherFraction is the sub-voucher
  // remainder toward the next whole grant (always < 1, independent of grant size), so
  // scaling it would push it past the valid range and have it sanitized back to 0.
  (raw) => ({
    ...raw,
    vouchers: num(raw.vouchers) * 10,
  }),
];

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * A hand-edited or re-encoded save can arrive with saveVersion as a numeric string, which
 * would otherwise silently restart the chain at 1 and re-run migrations. Coerced here, with
 * a local helper, so migrate() stays usable without state.ts.
 */
function versionOf(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 1;
}

export function migrate(raw: Raw): Raw {
  const version = versionOf(raw.saveVersion);
  if (version > SAVE_VERSION) {
    throw new Error(`Save version ${version} is newer than supported ${SAVE_VERSION}`);
  }
  let out: Raw = { ...raw, saveVersion: version };
  for (let v = version; v < SAVE_VERSION; v++) {
    const step = steps[v];
    if (!step) throw new Error(`No migration step for save version ${v}`);
    out = step(out);
    out.saveVersion = v + 1;
  }
  return out;
}
