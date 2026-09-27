import { render } from '@testing-library/react';
import { StaffRow } from './StaffRow';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(mood: 'ok' | 'cooked', owned: Record<string, number> = {}) {
  const state = createInitialState({ wall: 0, mono: 0 }, content);
  Object.assign(state.staff, owned);
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, mood });
}

describe('StaffRow', () => {
  it('shows the ok mood from the store', () => {
    seed('ok');
    const { container } = render(<StaffRow staff={content.departments[0].staff[0]} mode={1} index={0} />);
    expect(container.querySelector('[data-character]')).toHaveAttribute('data-mood', 'ok');
  });

  it('shows the cooked mood from the store', () => {
    seed('cooked');
    const { container } = render(<StaffRow staff={content.departments[0].staff[0]} mode={1} index={0} />);
    expect(container.querySelector('[data-character]')).toHaveAttribute('data-mood', 'cooked');
  });

  it('renders the milestone bar above the name, labelled with the next ×2', () => {
    const staff = content.departments[0].staff[0];
    seed('ok', { [staff.id]: 152 });
    const { container } = render(<StaffRow staff={staff} mode={1} index={0} />);
    const milestoneBar = container.querySelector('.milestone-bar');
    const name = container.querySelector('.staff-name');
    expect(milestoneBar).not.toBeNull();
    expect(milestoneBar!.textContent).toContain('×2 at 200');
    expect(milestoneBar!.compareDocumentPosition(name!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sets the speed bar --period from the staff slot and milestone multiplier', () => {
    const staff = content.departments[0].staff[1];
    seed('ok', { [staff.id]: 25 });
    const { container } = render(<StaffRow staff={staff} mode={1} index={1} />);
    const speedBar = container.querySelector('.speed-bar') as HTMLElement;
    expect(speedBar.style.getPropertyValue('--period')).toBe('0.3s');
  });

  it('marks the speed bar idle with 0 owned', () => {
    const staff = content.departments[0].staff[0];
    seed('ok', { [staff.id]: 0 });
    const { container } = render(<StaffRow staff={staff} mode={1} index={0} />);
    expect(container.querySelector('.speed-bar')).toHaveClass('idle');
  });

  it('marks the speed bar max speed once the cycle drops below 0.25s', () => {
    const staff = content.departments[0].staff[0];
    seed('ok', { [staff.id]: 400 });
    const { container } = render(<StaffRow staff={staff} mode={1} index={0} />);
    const speedBar = container.querySelector('.speed-bar');
    expect(speedBar).toHaveClass('max');
    expect(speedBar!.textContent).toContain('MAX');
  });
});
