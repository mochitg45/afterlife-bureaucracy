import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractStrings, overlayStrings } from './walk';
import { LANGS } from './index';

const dataDir = path.resolve(__dirname, '../data');
const i18nData = path.resolve(__dirname, 'data');

function files(dir: string, base = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name), `${base}${e.name}/`) : e.name.endsWith('.json') && e.name !== 'soul-faces.json' ? [base + e.name] : [],
  );
}
const raw = files(dataDir).map((f) => ({ rel: f.replace(/\.json$/, ''), json: JSON.parse(readFileSync(path.join(dataDir, f), 'utf8')) as unknown }));
const load = (l: string): Record<string, string> => JSON.parse(readFileSync(path.join(i18nData, `${l}.json`), 'utf8'));

describe('game-data overlay', () => {
  const en = load('en');

  it('the TS walker finds exactly the keys in en.json', () => {
    const found: Record<string, string> = {};
    for (const { rel, json } of raw) Object.assign(found, extractStrings(rel, json));
    expect(found).toEqual(en);
  });

  it('overlay(en) is the identity', () => {
    for (const { rel, json } of raw) expect(overlayStrings(rel, json, en)).toEqual(json);
  });

  for (const { code } of LANGS.filter((l) => l.code !== 'en')) {
    it(`${code}: every key lands on a text slot and every slot is translated`, () => {
      const map = load(code);
      expect(Object.keys(map)).toEqual(Object.keys(en));
      const landed: Record<string, string> = {};
      for (const { rel, json } of raw) Object.assign(landed, extractStrings(rel, overlayStrings(rel, json, map)));
      expect(landed).toEqual(map);
    });
  }
});
