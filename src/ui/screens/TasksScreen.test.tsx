import { Profiler } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { TasksScreen } from './TasksScreen';
import { useGame } from '../../store/game';
import { createInitialState, type GameState, type DailiesState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { dayKey } from '../../engine/dailies';
import { content } from '../../data';

const TASK_ID = 'd-clicks-1'; // kind: clicks, target: 150
const TASK_DEF = content.dailies.find((d) => d.id === TASK_ID)!;
const TASK_TEXT = TASK_DEF.text.replace('{n}', String(TASK_DEF.target));
// Claiming settles through the store's real clock, so the clock is frozen here and the seeded
// "today" read off it: a rollover mid-test would replace the task list under the assertions.
const NOW = new Date(2026, 8, 14, 10, 0, 0).getTime();
const TODAY = dayKey(NOW);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

function dailiesWith(overrides: Partial<DailiesState> = {}): DailiesState {
  return {
    date: TODAY,
    tasks: [{ id: TASK_ID, claimed: false }],
    skipped: [],
    streak: 3,
    bestStreak: 5,
    skipTokens: 1,
    lastTokenDate: TODAY,
    baseline: { clicks: 0, staffHired: 0, upgradesBought: 0, equips: 0, audits: 0, perksBought: 0, pulls: 0, adsWatched: 0 },
    completedToday: false,
    soulsPerSecSnapshot: '0',
    ...overrides,
  };
}

function seed(patch: Partial<GameState>) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }, content), ...patch };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true });
}

describe('TasksScreen', () => {
  it('shows the streak, best streak and skip tokens', () => {
    seed({ dailies: dailiesWith({ streak: 3, bestStreak: 5, skipTokens: 1 }) });
    render(<TasksScreen />);
    expect(screen.getByText('Streak: 3 days · Best: 5')).toBeInTheDocument();
    expect(screen.getByText('Skip tokens: 1')).toBeInTheDocument();
  });

  it('disables Claim below target', () => {
    seed({
      dailies: dailiesWith(),
      stats: { ...createInitialState({ wall: 0, mono: 0 }, content).stats, clicks: 100 },
    });
    render(<TasksScreen />);
    expect(screen.getByRole('button', { name: `Claim: ${TASK_TEXT}` })).toBeDisabled();
  });

  it('enables Claim at target and claims on click', () => {
    seed({
      dailies: dailiesWith(),
      stats: { ...createInitialState({ wall: 0, mono: 0 }, content).stats, clicks: 150 },
    });
    render(<TasksScreen />);
    const claimBtn = screen.getByRole('button', { name: `Claim: ${TASK_TEXT}` });
    expect(claimBtn).toBeEnabled();
    fireEvent.click(claimBtn);
    expect(useGame.getState().state.dailies.tasks[0].claimed).toBe(true);
    expect(screen.getByText('Claimed')).toBeInTheDocument();
  });

  it('shows Skip only when a token is available and the task is unfinished', () => {
    seed({
      dailies: dailiesWith({ skipTokens: 1 }),
      stats: { ...createInitialState({ wall: 0, mono: 0 }, content).stats, clicks: 0 },
    });
    render(<TasksScreen />);
    expect(screen.getByRole('button', { name: `Skip: ${TASK_TEXT}` })).toBeInTheDocument();
  });

  it('hides Skip without a skip token', () => {
    seed({
      dailies: dailiesWith({ skipTokens: 0 }),
      stats: { ...createInitialState({ wall: 0, mono: 0 }, content).stats, clicks: 0 },
    });
    render(<TasksScreen />);
    expect(screen.queryByRole('button', { name: `Skip: ${TASK_TEXT}` })).not.toBeInTheDocument();
  });

  it('hides Skip once the task is already done', () => {
    seed({
      dailies: dailiesWith({ skipTokens: 1 }),
      stats: { ...createInitialState({ wall: 0, mono: 0 }, content).stats, clicks: 150 },
    });
    render(<TasksScreen />);
    expect(screen.queryByRole('button', { name: `Skip: ${TASK_TEXT}` })).not.toBeInTheDocument();
  });

  it('shows the unlocked/total achievements header', () => {
    seed({ dailies: dailiesWith(), achievements: [content.achievements[0].id] });
    render(<TasksScreen />);
    expect(screen.getByText(`1 / ${content.achievements.length}`)).toBeInTheDocument();
  });

  it('dims a locked achievement badge and shows an unlocked one at full opacity', () => {
    const unlockedId = content.achievements[0].id;
    const lockedId = content.achievements[1].id;
    seed({ dailies: dailiesWith(), achievements: [unlockedId] });
    render(<TasksScreen />);
    const unlockedBadge = screen.getByText(content.achievements[0].name).closest('.badge-tile')!.querySelector('svg');
    const lockedBadge = screen.getByText(content.achievements[1].name).closest('.badge-tile')!.querySelector('svg');
    expect(unlockedBadge).toHaveAttribute('data-locked', 'false');
    expect(lockedBadge).toHaveAttribute('data-locked', 'true');
    void lockedId;
  });

  it('does not re-render when only kc changes on a tick', () => {
    seed({ dailies: dailiesWith(), achievements: [content.achievements[0].id] });
    let commits = 0;
    render(
      <Profiler id="tasks" onRender={() => { commits += 1; }}>
        <TasksScreen />
      </Profiler>,
    );
    const badge = screen.getByText(content.achievements[0].name).closest('.badge-tile');
    const before = commits;
    act(() => {
      useGame.setState({ state: { ...useGame.getState().state, kc: new Decimal(1) } });
    });
    expect(commits).toBe(before);
    expect(screen.getByText(content.achievements[0].name).closest('.badge-tile')).toBe(badge);
  });
});
