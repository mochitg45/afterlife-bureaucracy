import { render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { LedgerScreen } from './LedgerScreen';
import { useGame } from '../../store/game';
import { createInitialState, type GameState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';
import { AUDIT_THRESHOLD } from '../../engine/prestige';
import { formatNumber } from '../../engine/format';

function seed(patch: Partial<GameState>) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }, content), ...patch };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, lastAudit: null });
}

describe('LedgerScreen', () => {
  it('disables the audit below the threshold', () => {
    seed({ soulsRun: new Decimal(10) });
    render(<LedgerScreen />);
    expect(screen.getByRole('button', { name: /file annual audit/i })).toBeDisabled();
    const needText = new RegExp(`need ${formatNumber(AUDIT_THRESHOLD).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} souls`, 'i');
    expect(screen.getByText(needText)).toBeInTheDocument();
  });
  it('shows the seal preview and requires confirmation', () => {
    seed({ soulsRun: new Decimal(AUDIT_THRESHOLD).mul(9), staff: { dave: 3 } });
    render(<LedgerScreen />);
    expect(screen.getByText(/\+3 seals/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /file annual audit/i }));
    expect(useGame.getState().state.seals).toBe(0);
    expect(screen.getByText(/confirm audit/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /file annual audit/i }));
    expect(useGame.getState().state.seals).toBe(3);
    expect(useGame.getState().state.staff).toEqual({});
    expect(useGame.getState().lastAudit).toEqual({ sealsGained: 3, fiscalYear: 2 });
  });
  it('renders the perk tree and buys an available perk', () => {
    seed({ seals: 2 });
    render(<LedgerScreen />);
    const root = screen.getByRole('button', { name: /stamped memo pads/i });
    expect(root).toBeEnabled();
    expect(screen.getByRole('button', { name: /two-sided forms/i })).toBeDisabled();
    fireEvent.click(root);
    expect(useGame.getState().state.perks).toEqual(['throughput-1']);
    expect(useGame.getState().state.seals).toBe(1);
    expect(screen.getByRole('button', { name: /stamped memo pads/i })).toHaveClass('owned');
    expect(screen.getByRole('button', { name: /two-sided forms/i })).toHaveClass('unaffordable');
  });
  it('shows the cosmic placeholder', () => {
    seed({});
    render(<LedgerScreen />);
    expect(screen.getByText(/unlocks at 100 seals/i)).toBeInTheDocument();
  });
});
