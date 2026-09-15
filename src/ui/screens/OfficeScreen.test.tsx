import { render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { OfficeScreen } from './OfficeScreen';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(kc: number) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }, content), kc: new Decimal(kc) };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, queueLine: content.departments[0].queue[0], memoLine: content.departments[0].memos[0] });
}

describe('OfficeScreen', () => {
  it('stamps a soul', () => {
    seed(0);
    render(<OfficeScreen />);
    fireEvent.pointerDown(screen.getByRole('button', { name: /stamp soul/i }));
    expect(useGame.getState().state.soulsRun.toNumber()).toBe(1);
  });
  it('hires Dave when affordable and disables when not', () => {
    seed(20);
    render(<OfficeScreen />);
    const hire = screen.getByRole('button', { name: /hire dave/i });
    expect(hire).toBeEnabled();
    fireEvent.click(hire);
    expect(useGame.getState().state.staff.dave).toBe(1);
    expect(screen.getByRole('button', { name: /hire dave/i })).toBeDisabled();
  });
  it('switches buy mode', () => {
    seed(100000);
    render(<OfficeScreen />);
    fireEvent.click(screen.getByRole('button', { name: '×10' }));
    fireEvent.click(screen.getByRole('button', { name: /hire dave/i }));
    expect(useGame.getState().state.staff.dave).toBe(10);
  });
  it('buys an upgrade', () => {
    seed(50);
    render(<OfficeScreen />);
    fireEvent.click(screen.getByRole('button', { name: /faster stapler/i }));
    expect(useGame.getState().state.upgrades['faster-stapler']).toBe(1);
  });
  it('shows queue line and memo', () => {
    seed(0);
    render(<OfficeScreen />);
    expect(screen.getByText(content.departments[0].queue[0])).toBeInTheDocument();
    expect(screen.getByText(content.departments[0].memos[0])).toBeInTheDocument();
  });
  it('watches an ad for the Overtime Boost', () => {
    const watchAd = vi.fn(async () => 'rewarded' as const);
    seed(0);
    useGame.setState({ adsReady: true, watchAd });
    render(<OfficeScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Overtime Boost' }));
    expect(watchAd).toHaveBeenCalledWith('overtime-boost');
  });

  it('counts down an Overtime Boost that is already running', () => {
    seed(0);
    const state = useGame.getState().state;
    // watchAd always sets both: four hours of boost inside an eight-hour cooldown.
    useGame.setState({
      adsReady: true,
      state: {
        ...state,
        boostUntilWall: Date.now() + 2 * 3600_000,
        adState: { ...state.adState, boostCooldownUntilWall: Date.now() + 6 * 3600_000 },
      },
    });
    render(<OfficeScreen />);
    expect(screen.getByRole('button', { name: 'Overtime Boost' })).toBeDisabled();
    expect(screen.getByText('×2 for 2h 0m')).toBeInTheDocument();
  });

  it('shows the Overtime Boost cooldown', () => {
    seed(0);
    const state = useGame.getState().state;
    useGame.setState({
      adsReady: true,
      state: { ...state, adState: { ...state.adState, boostCooldownUntilWall: Date.now() + 3 * 3600_000 } },
    });
    render(<OfficeScreen />);
    expect(screen.getByText('Available in 3h 0m')).toBeInTheDocument();
  });

  it('says when there is no ad to show', () => {
    seed(0);
    useGame.setState({ adsReady: false });
    render(<OfficeScreen />);
    expect(screen.getByRole('button', { name: 'Overtime Boost' })).toBeDisabled();
    expect(screen.getByText('Ad not available')).toBeInTheDocument();
  });
});