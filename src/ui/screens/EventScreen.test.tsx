import { render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { EventScreen } from './EventScreen';
import { OfficeScreen } from './OfficeScreen';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { activeEvent } from '../../engine/events';
import { content } from '../../data';

const NOW = Date.UTC(2026, 9, 25, 12);

// The store's actions sync the event against the real clock, so pin it inside Halloween.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

function seed(forceId: string | null, patch: { points?: number; earned?: number; vouchers?: number } = {}) {
  const occ = forceId ? activeEvent(content, NOW) : null;
  const base = createInitialState({ wall: 0, mono: 0 }, content);
  const state = {
    ...base,
    vouchers: patch.vouchers ?? 0,
    event: occ ? { key: occ.key, points: new Decimal(patch.points ?? 0), earned: new Decimal(patch.earned ?? 0), staff: {}, claimed: [] } : null,
  };
  useGame.setState({
    state,
    rates: computeRates(state, content, 0),
    ready: true,
    queueLine: content.departments[0].queue[0],
    memoLine: content.departments[0].memos[0],
    activeEvent: () => occ,
  });
  return occ;
}

describe('Event banner', () => {
  it('shows only while an event is active', () => {
    seed(null);
    const { unmount } = render(<OfficeScreen onOpenEvent={() => {}} />);
    expect(screen.queryByText('SPECIAL EVENT')).toBeNull();
    unmount();
    const occ = seed('halloween')!;
    const open = vi.fn();
    render(<OfficeScreen onOpenEvent={open} />);
    expect(screen.getByText('SPECIAL EVENT')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Open ${occ.deptName}` }));
    expect(open).toHaveBeenCalled();
  });
});

describe('EventScreen', () => {
  it('renders staff, track and banner, and back returns', () => {
    const occ = seed('halloween')!;
    const back = vi.fn();
    render(<EventScreen onBack={back} />);
    expect(screen.getByText(occ.staff[0].name)).toBeInTheDocument();
    expect(screen.getByTestId('tier-0')).toBeInTheDocument();
    expect(screen.getByText(occ.banner!.name)).toBeInTheDocument();
    expect(screen.getByTestId('featured-card')).toBeInTheDocument();
    expect(screen.getByText('Live now')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back to office/i }));
    expect(back).toHaveBeenCalled();
  });
  it('stamping raises points', () => {
    seed('halloween');
    render(<EventScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /stamp event soul/i }));
    expect(useGame.getState().state.event!.points.toNumber()).toBe(1);
  });
  it('claims a reached tier', () => {
    const occ = seed('halloween', { earned: 1e12 })!;
    render(<EventScreen onBack={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: /claim tier 1/i })[0]);
    expect(useGame.getState().state.event!.claimed).toContain(0);
    expect(occ.track.length).toBeGreaterThan(0);
  });
  it('buys event staff when affordable', () => {
    const occ = seed('halloween', { points: 1000, earned: 1000 })!;
    render(<EventScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: `Hire ${occ.staff[0].name}` }));
    expect(useGame.getState().state.event!.staff[occ.staff[0].id]).toBe(1);
  });
  it('pull buttons disable without vouchers and call pullEvent with them', () => {
    seed('halloween', { vouchers: 0 });
    const { unmount } = render(<EventScreen onBack={() => {}} />);
    expect(screen.getByRole('button', { name: /pull one event card/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /pull ten event cards/i })).toBeDisabled();
    unmount();
    seed('halloween', { vouchers: 100 });
    const pullEvent = vi.fn();
    useGame.setState({ pullEvent });
    render(<EventScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /pull one event card/i }));
    fireEvent.click(screen.getByRole('button', { name: /pull ten event cards/i }));
    expect(pullEvent).toHaveBeenNthCalledWith(1, 1);
    expect(pullEvent).toHaveBeenNthCalledWith(2, 10);
  });
  it('falls back to the office when the event has ended', () => {
    seed(null);
    const back = vi.fn();
    render(<EventScreen onBack={back} />);
    expect(back).toHaveBeenCalled();
  });
});
