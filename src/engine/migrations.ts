export const SAVE_VERSION = 1;

type Raw = Record<string, unknown>;

// steps[v] upgrades a save from version v to v+1. Version 0 never shipped,
// so the array starts empty; the first real entry will be steps[1].
const steps: Array<(raw: Raw) => Raw> = [];

export function migrate(raw: Raw): Raw {
  const version = typeof raw.saveVersion === 'number' ? raw.saveVersion : 1;
  if (version > SAVE_VERSION) {
    throw new Error(`Save version ${version} is newer than supported ${SAVE_VERSION}`);
  }
  let out: Raw = { ...raw, saveVersion: version };
  for (let v = version; v < SAVE_VERSION; v++) {
    out = steps[v](out);
    out.saveVersion = v + 1;
  }
  return out;
}
