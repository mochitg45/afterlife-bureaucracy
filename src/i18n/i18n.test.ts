import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LANGS, LANG_KEY, detectLang, getLang, initI18n, t, tn } from './index';
import en from './ui/en.json';

const ui = (l: string): Record<string, string> => JSON.parse(readFileSync(path.resolve(__dirname, `ui/${l}.json`), 'utf8'));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const others = LANGS.filter((l) => l.code !== 'en').map((l) => l.code);

afterEach(async () => {
  localStorage.removeItem(LANG_KEY);
  await initI18n('en');
});

describe('t / tn', () => {
  it('interpolates {vars} and leaves unknown placeholders alone', () => {
    expect(t('time.minAgo', { n: 5 })).toBe('5 min ago');
    expect(t('time.minAgo')).toBe('{n} min ago');
  });

  it('falls back to the key itself when nothing matches', () => {
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('picks plural forms', () => {
    expect(tn('time.daysAgo', 1)).toBe('1 day ago');
    expect(tn('time.daysAgo', 3)).toBe('3 days ago');
  });

  it('uses the active language and falls back to English per key', async () => {
    await initI18n('id');
    expect(getLang()).toBe('id');
    expect(document.documentElement.lang).toBe('id');
    expect(t('settings.title')).toBe(ui('id')['settings.title']);
    expect(t('settings.title')).not.toBe('Settings');
  });
});

describe('detectLang', () => {
  it('matches device languages to the supported nine', () => {
    expect(detectLang(['en-US'])).toBe('en');
    expect(detectLang(['id-ID'])).toBe('id');
    expect(detectLang(['in'])).toBe('id');
    expect(detectLang(['es-MX'])).toBe('es-419');
    expect(detectLang(['es-419'])).toBe('es-419');
    expect(detectLang(['pt-PT'])).toBe('pt-BR');
    expect(detectLang(['de'])).toBe('de-DE');
    expect(detectLang(['fr-CA'])).toBe('fr-FR');
    expect(detectLang(['ja'])).toBe('ja-JP');
    expect(detectLang(['ko-KR'])).toBe('ko-KR');
    expect(detectLang(['th-TH'])).toBe('th');
  });

  it('skips unsupported languages for the next preference, then falls back to English', () => {
    expect(detectLang(['sv-SE', 'de-AT'])).toBe('de-DE');
    expect(detectLang(['sv-SE', 'ru'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });

  it('a stored choice beats the device language; a bogus one is ignored', () => {
    expect(detectLang(['de'], 'th')).toBe('th');
    expect(detectLang(['de'], 'xx')).toBe('de-DE');
  });

  it('initI18n reads the stored choice', async () => {
    localStorage.setItem(LANG_KEY, 'ja-JP');
    expect(await initI18n()).toBe('ja-JP');
  });
});

describe('UI dictionaries', () => {
  it('English has no empty values', () => {
    for (const [k, v] of Object.entries(en)) expect(v, k).not.toBe('');
  });

  for (const code of others) {
    it(`${code}: same keys as English, none empty, placeholders preserved`, () => {
      const d = ui(code);
      const enKeys = Object.keys(en);
      expect(Object.keys(d).filter((k) => !(k in en)), 'extra keys').toEqual([]);
      expect(enKeys.filter((k) => !(k in d)), 'missing keys').toEqual([]);
      for (const k of enKeys) {
        expect(d[k], k).not.toBe('');
        expect(placeholders(d[k]), `placeholders of ${k}`).toEqual(placeholders((en as Record<string, string>)[k]));
      }
    });
  }
});
