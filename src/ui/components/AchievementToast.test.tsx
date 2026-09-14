import { act, render, screen } from '@testing-library/react';
import { AchievementToast } from './AchievementToast';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';
import type { AchievementDef } from '../../engine/content';

function seed(recentAchievements: AchievementDef[]) {
  const state = createInitialState({ wall: 0, mono: 0 }, content);
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, recentAchievements });
}

describe('AchievementToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing without a recent achievement', () => {
    seed([]);
    const { container } = render(<AchievementToast />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the badge and name as a status toast, then clears after 3000 ms', () => {
    const ach = content.achievements[0];
    seed([ach]);
    render(<AchievementToast />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(screen.getByText(ach.name)).toBeInTheDocument();
    expect(status.querySelector('svg')).toHaveAttribute('data-kind', ach.badge);

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(useGame.getState().recentAchievements).toEqual([]);
  });
});
