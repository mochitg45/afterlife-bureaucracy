import { render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { OfficeScreen } from './OfficeScreen';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(kc: number) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }), kc: new Decimal(kc) };
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
});
