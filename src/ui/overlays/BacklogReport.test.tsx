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
  it('shows earnings and doubles them', () => {
    const state = createInitialState({ wall: 0, mono: 0 });
    useGame.setState({
      state, rates: computeRates(state, content, 0),
      pendingOffline: { elapsedSec: 7200, creditedSec: 7200, souls: new Decimal(900), kc: new Decimal(360), capped: false },
    });
    render(<BacklogReport />);
    expect(screen.getByText(/2h 0m/)).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /×2/i }));
    expect(useGame.getState().state.soulsRun.toNumber()).toBe(900);
    expect(useGame.getState().pendingOffline).toBeNull();
  });
  it('mentions the cap when capped', () => {
    const state = createInitialState({ wall: 0, mono: 0 });
    useGame.setState({
      state, rates: computeRates(state, content, 0),
      pendingOffline: { elapsedSec: 40000, creditedSec: 14400, souls: new Decimal(1), kc: new Decimal(1), capped: true },
    });
    render(<BacklogReport />);
    expect(screen.getByText(/backlog full/i)).toBeInTheDocument();
  });
});
