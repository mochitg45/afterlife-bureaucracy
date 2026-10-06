/**
 * One walker for the game-data text keys, shared by extraction (tests) and the load-time
 * overlay. Must stay in step with scripts/i18n-extract.mjs (a test pins the two together).
 *
 * Key = file path + JSON path, with an object's `id` standing in for its array index.
 */
export const TEXT_FIELDS = new Set(['name', 'flavor', 'desc', 'title', 'role', 'text', 'blurb', 'deptName', 'caption', 'currency', 'line', 'memo', 'body', 'label', 'hint', 'tagline', 'cta']);
export const TEXT_ARRAYS = new Set(['queue', 'memos', 'memosLate', 'lines', 'pages']);

type Fn = (key: string, value: string) => string;

/** Deep copy of `node` with every text slot replaced by `fn(key, current)`. */
export function mapStrings<T>(rel: string, node: T, fn: Fn, prefix = ''): T {
  const walk = (n: unknown, p: string): unknown => {
    if (Array.isArray(n)) {
      return n.map((v, i) => {
        const k = v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string' ? (v as { id: string }).id : String(i);
        return walk(v, p ? `${p}.${k}` : k);
      });
    }
    if (n && typeof n === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(n)) {
        const q = p ? `${p}.${k}` : k;
        if (typeof v === 'string' && TEXT_FIELDS.has(k)) out[k] = fn(`${rel}#${q}`, v);
        else if (Array.isArray(v) && TEXT_ARRAYS.has(k) && v.every((x) => typeof x === 'string')) out[k] = v.map((s, i) => fn(`${rel}#${q}.${i}`, s));
        else out[k] = walk(v, q);
      }
      return out;
    }
    return n;
  };
  return walk(node, prefix) as T;
}

/** Every text slot of one data file as key -> string. */
export function extractStrings(rel: string, node: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  mapStrings(rel, node, (k, v) => { out[k] = v; return v; });
  return out;
}

/** The node with translated strings laid over it; slots with no translation keep their English. */
export function overlayStrings<T>(rel: string, node: T, map: Record<string, string>): T {
  return mapStrings(rel, node, (k, v) => map[k] ?? v);
}
