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
  it('holds the toast while a requisition reveal is open, then shows it', () => {
    seed([content.achievements[0]]);
    useGame.setState({ pendingPull: [] as never });
    const { container } = render(<AchievementToast />);
    expect(container.querySelector('.toast')).toBeNull();
    act(() => { useGame.setState({ pendingPull: null }); });
    expect(screen.getByRole('status')).toHaveTextContent(content.achievements[0].name);
  });

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

  it('shows the badge and name as a status toast, then clears after 4000 ms', () => {
    const ach = content.achievements[0];
    seed([ach]);
    render(<AchievementToast />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(screen.getByText(ach.name)).toBeInTheDocument();
    expect(status.querySelector('svg')).toHaveAttribute('data-kind', ach.badge);

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(useGame.getState().recentAchievements).toEqual([]);
  });

  it('says how many vouchers the achievement paid, and closes on tap', () => {
    const ach = content.achievements.find((a) => a.vouchers)!;
    seed([ach]);
    render(<AchievementToast />);
    expect(screen.getByRole('status')).toHaveTextContent(`Reward+${ach.vouchers}`);
    act(() => { screen.getByRole('status').click(); });
    expect(useGame.getState().recentAchievements).toEqual([]);
  });

  it('shows no reward pill for an achievement that pays nothing', () => {
    const ach = { ...content.achievements[0], vouchers: undefined };
    seed([ach]);
    const { container } = render(<AchievementToast />);
    expect(container.querySelector('.ach-reward')).toBeNull();
  });

  it('every achievement pays a prize, so every toast has one to show', () => {
    expect(content.achievements.filter((a) => !a.vouchers).map((a) => a.id)).toEqual([]);
  });
});
