import { describe, expect, it } from 'vitest';
import { soulGender, soulFaceUrl } from './soulFace';
import counts from '../../data/soul-faces.json';

describe('soul faces', () => {
  it('reads gender from titles and known first names', () => {
    expect(soulGender("Mrs. Okafor — requests refund on last life, 'defective knees'")).toBe('f');
    expect(soulGender('Reginald T. — landlord, requests an upgrade to a suite')).toBe('m');
    expect(soulGender("Soul #20117 — asks if Heaven has Wi-Fi")).toBeNull();
  });

  it('keeps a named soul on faces of the same gender, stable per line', () => {
    const line = 'Sister Agnes — requests Heaven, brought references from three popes';
    const url = soulFaceUrl(line);
    if (counts.f > 0) expect(url).toMatch(/souls\/f-\d\d\.webp$/);
    expect(soulFaceUrl(line)).toBe(url);
  });
});
