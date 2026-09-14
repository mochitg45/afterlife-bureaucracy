import { render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { DeptChips } from './DeptChips';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(soulsRun: number, unlocked: string[]) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }, content), soulsRun: new Decimal(soulsRun), deptsUnlocked: unlocked, activeDept: unlocked[0] };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true });
}

describe('DeptChips', () => {
  it('renders every department, marks the active one, disables locked ones', () => {
    seed(5000, ['intake']);
    render(<DeptChips />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByRole('button', { name: /^intake$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /heaven admissions \(locked\)/i })).toBeDisabled();
  });
  it('switches the active department', () => {
    seed(20000, ['intake', 'heaven']);
    render(<DeptChips />);
    fireEvent.click(screen.getByRole('button', { name: /^heaven admissions$/i }));
    expect(useGame.getState().state.activeDept).toBe('heaven');
  });
  it('shows unlock progress for a locked department', () => {
    seed(5000, ['intake']);
    render(<DeptChips />);
    const chip = screen.getByRole('button', { name: /heaven admissions \(locked\)/i });
    expect(chip.querySelector('.bar-fill')).toHaveStyle({ width: '50%' });
  });
});
