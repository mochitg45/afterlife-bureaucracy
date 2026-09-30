import { act, render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { LedgerScreen } from './LedgerScreen';
import { useGame } from '../../store/game';
import { createInitialState, type GameState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';
import { AUDIT_BASE, SEAL_COEFF, auditThreshold, MIN_FISCAL_YEAR_MS } from '../../engine/prestige';
import { formatNumber } from '../../engine/format';

function seed(patch: Partial<GameState>) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }, content), ...patch };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, lastAudit: null });
}

/** Testing Library's string matcher needs the whole node text, so match on a prefix instead. */
const startingWith = (prefix: string) => (text: string) => text.startsWith(prefix);
const needPrefix = (year: number) => `Need ${formatNumber(auditThreshold(year))} souls this run`;

describe('LedgerScreen', () => {
  it('holds a ready audit until the fiscal year has run its 8 hours, and offers to expedite', () => {
    const opened = Date.now() - (MIN_FISCAL_YEAR_MS - 2 * 3_600_000); // 2h left: 4 vouchers
    seed({ soulsRun: new Decimal(AUDIT_BASE).mul(2), runStartWall: opened, vouchers: 3 });
    render(<LedgerScreen />);
    expect(screen.getByRole('button', { name: /file annual audit/i })).toBeDisabled();
    expect(screen.getByText(/fiscal year closes in 2h 0m/i)).toBeInTheDocument();
    // Three vouchers cannot buy a four-voucher expedite.
    expect(screen.getByRole('button', { name: /expedite the audit for 4 vouchers/i })).toBeDisabled();
  });
  it('expedites on the second tap: spends the vouchers and files the audit', () => {
    const opened = Date.now() - (MIN_FISCAL_YEAR_MS - 2 * 3_600_000);
    seed({ soulsRun: new Decimal(AUDIT_BASE).mul(2), runStartWall: opened, vouchers: 10 });
    render(<LedgerScreen />);
    const btn = screen.getByRole('button', { name: /expedite the audit for 4 vouchers/i });
    fireEvent.click(btn);
    expect(useGame.getState().state.fiscalYear).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /expedite the audit/i }));
    expect(useGame.getState().state.vouchers).toBe(6);
    expect(useGame.getState().state.fiscalYear).toBe(2);
  });
  it('disables the audit below the threshold', () => {
    seed({ soulsRun: new Decimal(10) });
    render(<LedgerScreen />);
    expect(screen.getByRole('button', { name: /file annual audit/i })).toBeDisabled();
    expect(screen.getByText(startingWith(needPrefix(1)))).toBeInTheDocument();
  });
  it('asks for the threshold of the current fiscal year, not year one', () => {
    seed({ soulsRun: new Decimal(AUDIT_BASE), fiscalYear: 3 });
    render(<LedgerScreen />);
    expect(screen.getByRole('button', { name: /file annual audit/i })).toBeDisabled();
    expect(screen.getByText(startingWith(needPrefix(3)))).toBeInTheDocument();
  });
  it('shows the seal preview and requires confirmation', () => {
    const gained = Math.floor(SEAL_COEFF * 4 ** 0.4);
    seed({ soulsRun: new Decimal(AUDIT_BASE).mul(4), staff: { dave: 3 } });
    render(<LedgerScreen />);
    expect(screen.getByText(`+${gained} Seals`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /file annual audit/i }));
    expect(useGame.getState().state.seals).toBe(0);
    expect(screen.getByText(/confirm audit/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /file annual audit/i }));
    expect(useGame.getState().state.seals).toBe(gained);
    expect(useGame.getState().state.staff).toEqual({});
    expect(useGame.getState().lastAudit).toEqual({ sealsGained: gained, fiscalYear: 2 });
  });
  it('refreshes the audit readout on a tick without re-rendering the perk tree', () => {
    seed({ seals: 2 });
    render(<LedgerScreen />);
    const before = screen.getByRole('button', { name: /stamped memo pads/i });
    expect(screen.getByText(startingWith(needPrefix(1)))).toHaveTextContent('(0 so far)');
    act(() => {
      const state = useGame.getState().state;
      useGame.setState({ state: { ...state, soulsRun: new Decimal(123) } });
    });
    expect(screen.getByText(startingWith(needPrefix(1)))).toHaveTextContent('(123 so far)');
    expect(screen.getByRole('button', { name: /stamped memo pads/i })).toBe(before);
  });
  it('renders the perk tree and buys an available perk', () => {
    const rootCost = content.perks.find((p) => p.id === 'throughput-1')!.cost;
    seed({ seals: rootCost + 1 });
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
  it('applies the clause seal multiplier to the audit preview', () => {
    const mult = 1.5; // clause-seals-1
    const gained = Math.floor(SEAL_COEFF * 4 ** 0.4 * mult);
    seed({ soulsRun: new Decimal(AUDIT_BASE).mul(4), cosmicClauses: ['clause-seals-1'] });
    render(<LedgerScreen />);
    expect(screen.getByText(`+${gained} Seals`)).toBeInTheDocument();
  });
  it('shows the locked cosmic panel', () => {
    seed({});
    render(<LedgerScreen />);
    expect(screen.getByText(/unlocks at 6,?000 seals/i)).toBeInTheDocument();
  });
  it('shows the settings gear', () => {
    seed({});
    const onSettings = vi.fn();
    render(<LedgerScreen onSettings={onSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(onSettings).toHaveBeenCalled();
  });
});