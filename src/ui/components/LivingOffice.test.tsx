import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useGame } from '../../store/game';
import { emitStamp } from '../stampEvents';
import { LivingOffice } from './LivingOffice';

function setStaff(staff: Record<string, number>) {
  const s = useGame.getState().state;
  useGame.setState({ state: { ...s, staff } });
}

afterEach(cleanup);

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

  it('caps departing souls', () => {
    setStaff({});
    const { container } = render(<LivingOffice dept="limbo" />);
    act(() => { for (let i = 0; i < 20; i++) emitStamp({ golden: false, combo: i }); });
    expect(container.querySelectorAll('[data-departing]').length).toBe(6);
  });
});
