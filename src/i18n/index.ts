/**
 * Localization core. Language is chosen once per page load (see main.tsx): the data overlay and
 * module-level `t()` constants are computed at import time, so a language change persists the
 * choice and reloads the app instead of re-rendering a live tree.
 *
 * Preference lives in its own localStorage key, not in the save: it is needed synchronously
 * before the async save store opens, it is a device choice (a cloud save restored on another
 * phone must not flip its language), and it needs no SAVE_VERSION migration.
 */
import en from './ui/en.json';

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'es-419', label: 'Español' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'th', label: 'ไทย' },
] as const;
export type Lang = (typeof LANGS)[number]['code'];

export const LANG_KEY = 'afterlife.lang';

const BASE: Record<string, Lang> = { en: 'en', id: 'id', in: 'id', es: 'es-419', pt: 'pt-BR', de: 'de-DE', fr: 'fr-FR', ja: 'ja-JP', ko: 'ko-KR', th: 'th' };

export function isLang(x: unknown): x is Lang {
  return LANGS.some((l) => l.code === x);
}

/** A stored choice wins; otherwise the first device language we support; otherwise English. */
export function detectLang(navLangs: readonly string[], stored?: string | null): Lang {
  if (isLang(stored)) return stored;
  for (const n of navLangs) {
    const exact = LANGS.find((l) => l.code.toLowerCase() === n.toLowerCase());
    if (exact) return exact.code;
    const base = BASE[n.toLowerCase().split(/[-_]/)[0]];
    if (base) return base;
  }
  return 'en';
}

let lang: Lang = 'en';
let dict: Record<string, string> = en;
let dataMap: Record<string, string> | null = null;

const uiFiles = import.meta.glob<Record<string, string>>(['./ui/*.json', '!./ui/en.json'], { import: 'default' });
const dataFiles = import.meta.glob<Record<string, string>>('./data/*.json', { import: 'default' });

function readStored(): string | null {
  try { return localStorage.getItem(LANG_KEY); } catch { return null; }
}

/** Loads the dictionaries for `l` (default: stored or device language). Await before importing the app. */
export async function initI18n(l?: Lang): Promise<Lang> {
  lang = l ?? detectLang(typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]), readStored());
  dict = en;
  dataMap = null;
  if (lang !== 'en') {
    const [ui, data] = await Promise.all([uiFiles[`./ui/${lang}.json`]?.(), dataFiles[`./data/${lang}.json`]?.()]);
    if (ui) dict = ui;
    if (data) dataMap = data;
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  return lang;
}

export const getLang = (): Lang => lang;
/** Translated game-data strings for the active language, or null in English. */
export const getDataMap = (): Record<string, string> | null => dataMap;

/** Saves the choice and reloads so every string (content included) is rebuilt in it. */
export function setLang(l: Lang): void {
  try { localStorage.setItem(LANG_KEY, l); } catch { /* private mode: the choice lasts until reload only */ }
  try { window.location.reload(); } catch { /* not a browser */ }
}

const enDict = en as Record<string, string>;

/** `{name}` interpolation; a missing translation falls back to English, then to the key. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const s = dict[key] ?? enDict[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Plural: looks up `key.<category>` for the language's plural rule, falling back to `key.other`. */
export function tn(key: string, n: number, vars?: Record<string, string | number>): string {
  const k = `${key}.${new Intl.PluralRules(lang).select(n)}`;
  return t(k in dict || k in enDict ? k : `${key}.other`, { n, ...vars });
}

/** Dates and times in the active locale. */
export function fmtDate(ms: number, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(lang, opts).format(ms);
}
