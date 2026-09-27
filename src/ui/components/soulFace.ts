import counts from '../../data/soul-faces.json';

/**
 * Faces for the "Now serving" soul. People get a random face that is stable per queue line
 * and keeps the soul's gender: from a title or first name ("Mrs.", "Reginald"), or for an
 * unnamed "Soul #…" from the pronouns in the line. Pets never draw randomly: a pet line is
 * written as "a-07|Line text" and names its own face, so the species always matches.
 */
type Gender = 'f' | 'm';
const FACES = counts as Record<string, number>;

const FEMALE = new Set(['Astrid', 'Auntie', 'Baroness', 'Beatriz', 'Freydis', 'Grandma', 'Gudrun', 'Gunnhild', 'Ines', 'Ingrid', 'Karen', 'Lady', 'Marisol', 'Mrs.', 'Ms.', 'Miss', 'Nana', 'Nonna', 'Priya', 'Ragna', 'Sister', 'Solveig', 'Widow', 'Ylva', 'Queen', 'Madame', 'Dame', 'Aunt']);
const MALE = new Set(['Bartholomew', 'Bjarke', 'Bjorn', 'Brother', 'Chad', 'Deacon', 'Declan', 'Dmitri', 'Erik', 'Grandpa', 'Halvard', 'Herr', 'Knut', 'Leif', 'Marcus', 'Mr.', 'Olaf', 'Pieter', 'Reginald', 'Sten', 'Torkel', 'Torvald', 'Trevor', 'Widower', 'Yusuf', 'Sir', 'Lord', 'King', 'Uncle', 'Father']);

export interface SoulCard {
  /** The text to show, without any face tag. */
  text: string;
  /** Face image URLs: one, two for twins, or none. */
  faces: string[];
}

const url = (id: string) => `${import.meta.env.BASE_URL}art/souls/${id}.webp`;

/** 'f' | 'm' from the name, or for unnamed souls from the pronouns; null when unknown. */
export function soulGender(line: string): Gender | null {
  const [name, rest = ''] = line.split(' — ');
  const first = name.trim().split(/\s+/)[0] ?? '';
  if (FEMALE.has(first)) return 'f';
  if (MALE.has(first)) return 'm';
  if (/\b(he|his|him|himself)\b/i.test(rest)) return 'm';
  if (/\b(she|her|hers|herself)\b/i.test(rest)) return 'f';
  return null;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function personFace(line: string): string | null {
  const g = soulGender(line);
  const pool: [Gender, number][] = g ? [[g, FACES[g] ?? 0]] : [['f', FACES.f ?? 0], ['m', FACES.m ?? 0]];
  const total = pool.reduce((n, [, c]) => n + c, 0);
  if (!total) return null;
  let i = hash(line) % total;
  for (const [kind, c] of pool) {
    if (i < c) return url(`${kind}-${String(i + 1).padStart(2, '0')}`);
    i -= c;
  }
  return null;
}

export function soulCard(line: string): SoulCard {
  const tagged = /^([a-z]-\d\d)\|(.*)$/s.exec(line);
  if (tagged) return { text: tagged[2], faces: [url(tagged[1])] };
  const face = personFace(line);
  if (!face) return { text: line, faces: [] };
  return { text: line, faces: /^The Twins\b/.test(line) ? [face, face] : [face] };
}
