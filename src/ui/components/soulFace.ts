import counts from '../../data/soul-faces.json';

/**
 * Faces for the "Now serving" soul. The face is random but stable per queue line, and
 * a named soul keeps its gender: a line about "Mrs. Okafor" only ever draws a woman's
 * face. Unnamed souls ("Soul #20117") draw from everyone, pets and aliens included.
 */
type Kind = 'f' | 'm' | 'a' | 'x';
const FACES = counts as Record<Kind, number>;

const FEMALE = new Set(['Astrid', 'Auntie', 'Baroness', 'Beatriz', 'Freydis', 'Grandma', 'Gudrun', 'Gunnhild', 'Ines', 'Ingrid', 'Karen', 'Lady', 'Marisol', 'Mrs.', 'Ms.', 'Miss', 'Nana', 'Nonna', 'Priya', 'Ragna', 'Sister', 'Solveig', 'Widow', 'Ylva', 'Queen', 'Madame', 'Dame', 'Aunt']);
const MALE = new Set(['Bartholomew', 'Bjarke', 'Bjorn', 'Brother', 'Chad', 'Deacon', 'Declan', 'Dmitri', 'Erik', 'Grandpa', 'Halvard', 'Herr', 'Knut', 'Leif', 'Marcus', 'Mr.', 'Olaf', 'Pieter', 'Reginald', 'Sten', 'Torkel', 'Torvald', 'Trevor', 'Widower', 'Yusuf', 'Sir', 'Lord', 'King', 'Uncle', 'Father']);

/** 'f' | 'm' for a named soul whose gender the name gives away, else null. */
export function soulGender(line: string): 'f' | 'm' | null {
  const first = line.split(' — ')[0].trim().split(/\s+/)[0] ?? '';
  if (FEMALE.has(first)) return 'f';
  if (MALE.has(first)) return 'm';
  return null;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The face file for a queue line, or null when there are no faces of that kind. */
export function soulFaceUrl(line: string): string | null {
  const g = soulGender(line);
  const pool: [Kind, number][] = g
    ? [[g, FACES[g] ?? 0]]
    : (Object.entries(FACES) as [Kind, number][]);
  const total = pool.reduce((n, [, c]) => n + c, 0);
  if (!total) return null;
  let i = hash(line) % total;
  for (const [kind, c] of pool) {
    if (i < c) return `${import.meta.env.BASE_URL}art/souls/${kind}-${String(i + 1).padStart(2, '0')}.webp`;
    i -= c;
  }
  return null;
}
