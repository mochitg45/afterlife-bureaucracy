import { describe, expect, it } from 'vitest';
import { soulCard, soulGender } from './soulFace';

describe('soul faces', () => {
  it('reads gender from titles, first names and, for unnamed souls, pronouns', () => {
    expect(soulGender("Mrs. Okafor — requests refund on last life, 'defective knees'")).toBe('f');
    expect(soulGender('Reginald T. — landlord, requests an upgrade to a suite')).toBe('m');
    expect(soulGender("Soul #46701 — died tripping over a cat that wasn't his")).toBe('m');
    expect(soulGender('Soul #20117 — asks if Heaven has Wi-Fi')).toBeNull();
  });

  it('keeps a named soul on faces of its gender, stable per line', () => {
    const line = 'Sister Agnes — requests Heaven, brought references from three popes';
    const card = soulCard(line);
    expect(card.faces[0]).toMatch(/souls\/f-\d\d\.webp$/);
    expect(soulCard(line)).toEqual(card);
  });

  it('never gives an unnamed person a pet face', () => {
    for (let i = 0; i < 200; i++) expect(soulCard(`Soul #${i} — lost`).faces[0]).toMatch(/souls\/[fm]-\d\d\.webp$/);
  });

  it('uses the tagged face for pets and strips the tag', () => {
    expect(soulCard('a-07|Clover the bunny — ate the wrong flower')).toEqual({
      text: 'Clover the bunny — ate the wrong flower',
      faces: [expect.stringMatching(/souls\/a-07\.webp$/)],
    });
  });

  it('shows identical twins with the same face twice', () => {
    const card = soulCard('The Twins — one form, two souls, please advise');
    expect(card.faces).toHaveLength(2);
    expect(card.faces[0]).toBe(card.faces[1]);
  });
});
