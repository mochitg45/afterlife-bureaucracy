import { render, screen, fireEvent, act } from '@testing-library/react';
import { useGame, type AllianceInfo } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { content } from '../../data';
import { ALLIANCE_TIERS, allianceWeek } from '../../engine/alliance';
import { AllianceCard } from './AllianceCard';

const week = allianceWeek(Date.now());
const view = { id: 'a1', name: 'Eternal Stampers', code: 'ABC234', size: 3, week, stamps: ALLIANCE_TIERS[0].stamps };

function seed(info: Partial<AllianceInfo>, extra: Record<string, unknown> = {}) {
  useGame.setState({
    state: createInitialState({ wall: 1, mono: 0 }, content),
    allianceInfo: { available: true, status: 'ready', view: null, busy: false, ...info },
    // The web store has no alliance server, so its calls are stubbed per test.
    refreshAlliance: vi.fn(async () => {}),
    ...extra,
  });
}

describe('AllianceCard', () => {
  it('asks for a connection where alliances are unavailable', () => {
    seed({ available: false });
    render(<AllianceCard />);
    expect(screen.getByText('Alliances need an internet connection.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers random join, create and join by code when not in an alliance', async () => {
    const joinRandomAlliance = vi.fn(async () => true);
    const joinAllianceByCode = vi.fn(async () => 'notfound' as const);
    seed({ status: 'none' }, { joinRandomAlliance, joinAllianceByCode });
    render(<AllianceCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Join a random alliance' }));
    expect(joinRandomAlliance).toHaveBeenCalled();
    const join = screen.getByRole('button', { name: 'Join by code' });
    expect(join.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'zzz999' } });
    await act(async () => fireEvent.click(join));
    expect(joinAllianceByCode).toHaveBeenCalledWith('ZZZ999');
    expect(screen.getByText('No alliance has that code.')).toBeTruthy();
  });

  it('shows the alliance, its code and claims reached tiers', () => {
    seed({ view });
    render(<AllianceCard />);
    expect(screen.getByText('Eternal Stampers')).toBeTruthy();
    expect(screen.getByText('ABC234')).toBeTruthy();
    expect(screen.getByText('3/10 members')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Claim alliance tier 2' }).hasAttribute('disabled')).toBe(true);
    // The real store action pays it: tier 1 is reached and the view is for this week.
    fireEvent.click(screen.getByRole('button', { name: 'Claim alliance tier 1' }));
    expect(useGame.getState().state.vouchers).toBe(ALLIANCE_TIERS[0].vouchers);
    expect(screen.queryByRole('button', { name: 'Claim alliance tier 1' })).toBeNull();
  });

  it('asks twice before leaving', async () => {
    const leaveAlliance = vi.fn(async () => true);
    seed({ view }, { leaveAlliance });
    render(<AllianceCard />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Leave alliance' })));
    expect(leaveAlliance).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Tap again to leave' })));
    expect(leaveAlliance).toHaveBeenCalled();
  });

  it('opens the weekly ranking', async () => {
    const loadAllianceRanking = vi.fn(async () => true);
    seed({ view }, { loadAllianceRanking, allianceRankingView: { top: [{ name: 'Eternal Stampers', souls: '10000', me: true }], rank: 1, total: 4 } });
    render(<AllianceCard />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Weekly ranking' })));
    expect(loadAllianceRanking).toHaveBeenCalled();
    expect(screen.getByText('Alliances this week: 4')).toBeTruthy();
  });
});
