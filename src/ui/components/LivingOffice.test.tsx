import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useGame } from '../../store/game';
import { emitStamp } from '../stampEvents';
import { LivingOffice } from './LivingOffice';
import { ANIMS } from '../anim/manifest';

function setStaff(staff: Record<string, number>) {
  const s = useGame.getState().state;
  useGame.setState({ state: { ...s, staff } });
}

function setEquipped(equipped: string[]) {
  const s = useGame.getState().state;
  useGame.setState({ state: { ...s, equipped } });
}
const ids = (c: HTMLElement) => [...c.querySelectorAll('[data-staff]')].map((e) => e.getAttribute('data-staff'));

afterEach(() => { cleanup(); setEquipped([]); });

describe('LivingOffice', () => {
  it('is decorative and shows only hired staff', () => {
    setStaff({ dave: 2 });
    const { container } = render(<LivingOffice dept="intake" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    const ids = [...container.querySelectorAll('[data-staff]')].map((e) => e.getAttribute('data-staff'));
    expect(ids).toEqual(['dave']);
  });

  it('sends a soul off on each stamp, floating up in heaven and down in hell', () => {
    setStaff({});
    const heaven = render(<LivingOffice dept="heaven" />);
    act(() => emitStamp({ golden: true, combo: 1 }));
    expect(heaven.container.querySelectorAll('[data-departing="up"].gold')).toHaveLength(1);
    heaven.unmount();
    const hell = render(<LivingOffice dept="hell" />);
    act(() => emitStamp({ golden: false, combo: 1 }));
    expect(hell.container.querySelectorAll('[data-departing="down"]')).toHaveLength(1);
  });

  it('reincarnates a soul as a newborn animal instead of flying it up', () => {
    setStaff({});
    const { container } = render(<LivingOffice dept="reincarnation" />);
    act(() => emitStamp({ golden: false, combo: 1 }));
    const leaving = container.querySelector('[data-departing="reborn"]');
    expect(leaving).not.toBeNull();
    expect(leaving!.querySelector('.lo-wings, .lo-halo')).toBeNull();
    expect(leaving!.querySelector('img.lo-baby')?.getAttribute('src')).toMatch(/^art\/anim\/reborn\/\w+\.webp$/);
  });

  it('caps departing souls', () => {
    setStaff({});
    const { container } = render(<LivingOffice dept="limbo" />);
    act(() => { for (let i = 0; i < 20; i++) emitStamp({ golden: false, combo: i }); });
    expect(container.querySelectorAll('[data-departing]').length).toBe(6);
  });

  it('uses sprite frames for staff with a work clip and the static hop for the rest', () => {
    // Every character has frames now, so hide Cooked Dave's to check the static breathe fallback.
    const cooked = ANIMS['dave-cooked'];
    delete ANIMS['dave-cooked'];
    try {
      setStaff({ dave: 1 });
      setEquipped(['c-dave-cooked']);
      const { container } = render(<LivingOffice dept="intake" />);
      expect(ANIMS.dave?.work).toBeTruthy();
      expect(container.querySelector('[data-staff="dave"] img[data-anim="dave"]')).not.toBeNull();
      expect(container.querySelector('[data-staff="dave"] .lo-hop')).toBeNull();
      expect(container.querySelector('[data-staff="c-dave-cooked"] .lo-breathe')).not.toBeNull();
    } finally {
      ANIMS['dave-cooked'] = cooked;
    }
  });

  it('fills the 4 spots with 2 equipped cards, the mascot and the most senior staff', () => {
    setStaff({ dave: 1, seraphine: 1, gary: 1, auditor: 1 });
    setEquipped(['c-dave-overtime', 'c-ferro']);
    const { container } = render(<LivingOffice dept="intake" />);
    expect(ids(container)).toEqual(['dave', 'auditor', 'c-ferro', 'c-dave-overtime']);
  });

  it('prefers the highest rarity, drops event cards, and glows by rarity', () => {
    setStaff({ dave: 1, seraphine: 1, gary: 1, auditor: 1 });
    setEquipped(['c-dave-overtime', 'c-hw-witch', 'c-bev-wings', 'c-seraph-board']);
    const { container } = render(<LivingOffice dept="intake" />);
    expect(ids(container)).toEqual(['dave', 'auditor', 'c-seraph-board', 'c-bev-wings']);
    expect(container.querySelector('[data-staff="c-seraph-board"] .lo-glow-executive')).not.toBeNull();
    expect(container.querySelector('[data-staff="c-bev-wings"] .lo-glow-senior')).not.toBeNull();
    expect(container.querySelector('[data-staff="c-bev-wings"] .lo-hop')).toBeNull();
  });

  it('gives temp cards no glow and keeps 3 staff beside one card', () => {
    setStaff({ dave: 1, seraphine: 1, gary: 1, auditor: 1 });
    setEquipped(['c-dave-overtime']);
    const { container } = render(<LivingOffice dept="intake" />);
    expect(ids(container)).toEqual(['dave', 'gary', 'auditor', 'c-dave-overtime']);
    expect(container.querySelector('.lo-glow')).toBeNull();
    expect(container.querySelector('[data-staff="c-dave-overtime"] img[data-anim="dave"]')).not.toBeNull();
  });
});
