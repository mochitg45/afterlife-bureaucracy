import { render, screen, fireEvent } from '@testing-library/react';
import { NotifPrompt } from './NotifPrompt';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

const ASK_AFTER_MS = 1_800_000;

function seed(daysAgo: number) {
  const state = createInitialState({ wall: 0, mono: 0 }, content);
  state.settings.notifOptIn = 'unasked';
  state.firstSeenWallClock = Date.now() - daysAgo;
  useGame.setState({
    state,
    rates: computeRates(state, content, 0),
    ready: true,
    pendingOffline: null,
    pendingPull: null,
    lastAudit: null,
  });
}

describe('NotifPrompt', () => {
  it('is absent before half an hour has passed', () => {
    seed(ASK_AFTER_MS - 60_000);
    const { container } = render(<NotifPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('appears once two days have passed and no other overlay is pending', () => {
    seed(ASK_AFTER_MS + 60_000);
    render(<NotifPrompt />);
    expect(screen.getByRole('dialog', { name: /reminders/i })).toBeInTheDocument();
  });

  it('stays hidden when another overlay is pending', () => {
    seed(ASK_AFTER_MS + 60_000);
    useGame.setState({ lastAudit: { sealsGained: 1, fiscalYear: 2 } });
    const { container } = render(<NotifPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('disappears after a choice is made', () => {
    seed(ASK_AFTER_MS + 60_000);
    const setNotifOptIn = vi.fn(async (v: 'yes' | 'no') => {
      useGame.setState((s) => ({ state: { ...s.state, settings: { ...s.state.settings, notifOptIn: v } } }));
    });
    useGame.setState({ setNotifOptIn });
    render(<NotifPrompt />);
    expect(screen.getByRole('dialog', { name: /reminders/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /yes, remind me/i }));
    expect(setNotifOptIn).toHaveBeenCalledWith('yes');
    expect(useGame.getState().state.settings.notifOptIn).toBe('yes');
  });
});
