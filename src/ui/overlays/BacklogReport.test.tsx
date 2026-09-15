import { render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { BacklogReport } from './BacklogReport';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

describe('BacklogReport', () => {
  it('renders nothing without pending offline', () => {
    useGame.setState({ pendingOffline: null });
    const { container } = render(<BacklogReport />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows earnings and doubles them with a rewarded ad', () => {
    const watchAd = vi.fn(async () => 'rewarded' as const);
    const state = createInitialState({ wall: 0, mono: 0 }, content);
    useGame.setState({
      state, rates: computeRates(state, content, 0), adsReady: true, watchAd,
      pendingOffline: { elapsedSec: 7200, creditedSec: 7200, souls: new Decimal(900), kc: new Decimal(360), capped: false },
    });
    render(<BacklogReport />);
    expect(screen.getByText(/2h 0m/)).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Watch ad ×2' }));
    expect(watchAd).toHaveBeenCalledWith('offline-double', undefined);
  });

  it('hides the ad button when the placement is closed', () => {
    const state = createInitialState({ wall: 0, mono: 0 }, content);
    useGame.setState({
      state, rates: computeRates(state, content, 0), adsReady: false,
      pendingOffline: { elapsedSec: 7200, creditedSec: 7200, souls: new Decimal(900), kc: new Decimal(360), capped: false },
    });
    render(<BacklogReport />);
    expect(screen.queryByRole('button', { name: 'Watch ad ×2' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /file it/i })).toBeInTheDocument();
  });
  it('mentions the cap when capped', () => {
    const state = createInitialState({ wall: 0, mono: 0 }, content);
    useGame.setState({
      state, rates: computeRates(state, content, 0),
      pendingOffline: { elapsedSec: 40000, creditedSec: 14400, souls: new Decimal(1), kc: new Decimal(1), capped: true },
    });
    render(<BacklogReport />);
    expect(screen.getByText(/backlog full/i)).toBeInTheDocument();
  });

  it('starts one ad however fast the button is tapped', () => {
    // Never resolves: the store only clears pendingOffline after the reward lands, so without
    // an in-flight guard the second tap would still pass canWatch and credit the backlog twice.
    const watchAd = vi.fn(() => new Promise<'rewarded'>(() => {}));
    const state = createInitialState({ wall: 0, mono: 0 }, content);
    useGame.setState({
      state, rates: computeRates(state, content, 0), adsReady: true, watchAd,
      pendingOffline: { elapsedSec: 7200, creditedSec: 7200, souls: new Decimal(900), kc: new Decimal(360), capped: false },
    });
    render(<BacklogReport />);
    const button = screen.getByRole('button', { name: 'Watch ad ×2' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(watchAd).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });
});