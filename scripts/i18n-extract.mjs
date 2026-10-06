/**
 * Extracts every player-facing string from src/data/*.json into src/i18n/data/en.json, a flat
 * map of stable key -> English text. Translations live beside it as <lang>.json with the same
 * keys and are overlaid onto the content at load (numbers, ids and art keys never leave the
 * English files, so balance changes need no re-translation).
 *
 * Key = file path + JSON path, using an object's `id` instead of its array index wherever it has
 * one (so reordering a list does not shuffle translations): "cards#c-dave.flavor",
 * "departments/intake#queue.3", "events#weekly.themes.valhalla-feast.staff.0.name".
 *
 * Run: `node scripts/i18n-extract.mjs`.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'src/data');

/** Fields that are text. Everything else (ids, character keys, art, numbers, enums) stays put. */
export const TEXT_FIELDS = new Set(['name', 'flavor', 'desc', 'title', 'role', 'text', 'blurb', 'deptName', 'caption', 'currency', 'line', 'memo', 'body', 'label', 'hint', 'tagline', 'cta']);
/** Arrays of plain strings that are text (queue lines, memos...). */
export const TEXT_ARRAYS = new Set(['queue', 'memos', 'memosLate', 'lines', 'pages']);

export function extract(rel, node, out, prefix = '') {
  if (Array.isArray(node)) {
    node.forEach((v, i) => {
      const k = v && typeof v === 'object' && typeof v.id === 'string' ? v.id : String(i);
      extract(rel, v, out, prefix ? `${prefix}.${k}` : k);
    });
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string' && TEXT_FIELDS.has(k)) out[`${rel}#${p}`] = v;
      else if (Array.isArray(v) && TEXT_ARRAYS.has(k) && v.every((x) => typeof x === 'string')) v.forEach((s, i) => { out[`${rel}#${p}.${i}`] = s; });
      else extract(rel, v, out, p);
    }
  }
  return out;
}

async function files(dir, base = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...(await files(path.join(dir, e.name), base + e.name + '/')));
    else if (e.name.endsWith('.json') && e.name !== 'soul-faces.json') out.push(base + e.name);
  }
  return out.sort();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const out = {};
  for (const f of await files(dataDir)) extract(f.replace(/\.json$/, ''), JSON.parse(await readFile(path.join(dataDir, f), 'utf8')), out);
  await writeFile(path.join(root, 'src/i18n/data/en.json'), JSON.stringify(out, null, 1) + '\n');
  const chars = Object.values(out).reduce((a, s) => a + s.length, 0);
  console.log(`${Object.keys(out).length} strings, ${chars} chars`);
}
