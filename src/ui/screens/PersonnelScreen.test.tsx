import { Profiler } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { PersonnelScreen } from './PersonnelScreen';
import { useGame } from '../../store/game';
import { createInitialState, type GameState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(patch: Partial<GameState>) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }, content), ...patch };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, pendingPull: null });
}
describe('PersonnelScreen', () => {
  it('disables pulls without vouchers and shows odds', () => {
    seed({ vouchers: 0 });
    render(<PersonnelScreen />);
    expect(screen.getByRole('button', { name: /draw one requisition/i })).toBeDisabled();
    expect(screen.getByText(/70%/)).toBeInTheDocument();
    expect(screen.getByText(/1\.5%/)).toBeInTheDocument();
  });
  it('pulls ten and opens the reveal', () => {
    seed({ vouchers: 9 });
    render(<PersonnelScreen />);
    fireEvent.click(screen.getByRole('button', { name: /draw ten requisitions/i }));
    expect(useGame.getState().pendingPull).toHaveLength(10);
    // Spends the 9-voucher cost, but with this fixed rngSeed (wall: 0) the ten pulls always land
    // an executive card, which settles the pre-existing "First Executive Card" achievement and
    // its +1 voucher reward in the same apply() call.
    expect(useGame.getState().state.vouchers).toBe(1);
  });
  it('equips and unequips from the collection', () => {
    seed({ cards: { 'c-dave-overtime': 1 } });
    render(<PersonnelScreen />);
    fireEvent.click(screen.getByRole('button', { name: /^dave, reaper, double overtime$/i }));
    expect(useGame.getState().state.equipped).toEqual(['c-dave-overtime']);
    expect(screen.getAllByText(/empty slot/i)).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: /^dave, reaper, double overtime$/i })[0]);
    expect(useGame.getState().state.equipped).toEqual([]);
  });
  it('offers a See odds shortcut that survives a jsdom without scrollIntoView', () => {
    seed({ vouchers: 0 });
    render(<PersonnelScreen />);
    const btn = screen.getByRole('button', { name: /see odds/i });
    expect(btn).toBeInTheDocument();
    expect(() => fireEvent.click(btn)).not.toThrow();
  });
  it('does not re-render when only kc changes on a tick', () => {
    seed({ cards: { 'c-dave-overtime': 1 } });
    let commits = 0;
    render(
      <Profiler id="personnel" onRender={() => { commits += 1; }}>
        <PersonnelScreen />
      </Profiler>,
    );
    const tile = screen.getAllByRole('button', { name: /^dave, reaper, double overtime$/i })[0];
    const before = commits;
    act(() => {
      useGame.setState({ state: { ...useGame.getState().state, kc: new Decimal(1) } });
    });
    expect(commits).toBe(before);
    expect(screen.getAllByRole('button', { name: /^dave, reaper, double overtime$/i })[0]).toBe(tile);
  });
  it('shows pity counters', () => {
    seed({ pity: { senior: 7, executive: 30 } });
    render(<PersonnelScreen />);
    expect(screen.getByText(/senior guaranteed in 3/i)).toBeInTheDocument();
    expect(screen.getByText(/executive guaranteed in 30/i)).toBeInTheDocument();
  });
  it('shows the settings gear', () => {
    seed({});
    const onSettings = vi.fn();
    render(<PersonnelScreen onSettings={onSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(onSettings).toHaveBeenCalled();
  });
  it('offers the free daily pull behind a rewarded ad', () => {
    const watchAd = vi.fn(async () => 'rewarded' as const);
    seed({ vouchers: 0 });
    useGame.setState({ adsReady: true, watchAd });
    render(<PersonnelScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Free daily pull' }));
    expect(watchAd).toHaveBeenCalledWith('free-pull', undefined);
  });

  it('closes the free pull once it has been taken today and says why', () => {
    seed({ vouchers: 0 });
    useGame.setState({ adsReady: false });
    render(<PersonnelScreen />);
    expect(screen.getByRole('button', { name: 'Free daily pull' })).toBeDisabled();
    expect(screen.getByText('Ad not available')).toBeInTheDocument();
  });
});