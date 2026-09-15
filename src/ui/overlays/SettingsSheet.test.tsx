import { render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { SettingsSheet } from './SettingsSheet';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';
import { APP_VERSION } from '../../version';

function seed(notifOptIn: 'unasked' | 'yes' | 'no') {
  const state = createInitialState({ wall: 0, mono: 0 }, content);
  state.settings.notifOptIn = notifOptIn;
  state.saveVersion = 4;
  state.fiscalYear = 2;
  state.soulsLifetime = new Decimal(12345);
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true });
}

describe('SettingsSheet', () => {
  it('renders nothing when closed', () => {
    seed('no');
    const { container } = render(<SettingsSheet open={false} onClose={() => {}} onGoToOdds={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reflects notifOptIn on the checkbox and updates it on change', () => {
    seed('no');
    const setNotifOptIn = vi.fn(async () => {});
    useGame.setState({ setNotifOptIn });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} />);
    const checkbox = screen.getByRole('checkbox', { name: /reminder notifications/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(setNotifOptIn).toHaveBeenCalledWith('yes');
  });

  it('shows the checkbox checked when opted in', () => {
    seed('yes');
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} />);
    const checkbox = screen.getByRole('checkbox', { name: /reminder notifications/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('shows save, version and calls onGoToOdds / onClose', () => {
    seed('no');
    const onGoToOdds = vi.fn();
    const onClose = vi.fn();
    render(<SettingsSheet open onClose={onClose} onGoToOdds={onGoToOdds} />);
    expect(screen.getByText('Save v4 · FY 2 · 12,345 souls lifetime')).toBeInTheDocument();
    expect(screen.getByText(APP_VERSION)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /see requisition odds/i }));
    expect(onGoToOdds).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
