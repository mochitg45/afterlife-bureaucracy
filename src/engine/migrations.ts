export const SAVE_VERSION = 2;

type Raw = Record<string, unknown>;

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
];

export function migrate(raw: Raw): Raw {
  const version = typeof raw.saveVersion === 'number' ? raw.saveVersion : 1;
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
