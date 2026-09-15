import { act, render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { SettingsSheet } from './SettingsSheet';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';
import { APP_VERSION, PRIVACY_URL } from '../../version';

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
    const { container } = render(<SettingsSheet open={false} onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reflects notifOptIn on the checkbox and updates it on change', () => {
    seed('no');
    const setNotifOptIn = vi.fn(async () => {});
    useGame.setState({ setNotifOptIn });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    const checkbox = screen.getByRole('checkbox', { name: /reminder notifications/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(setNotifOptIn).toHaveBeenCalledWith('yes');
  });

  it('shows the checkbox checked when opted in', () => {
    seed('yes');
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    const checkbox = screen.getByRole('checkbox', { name: /reminder notifications/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('shows save, version and calls onGoToOdds / onClose', () => {
    seed('no');
    const onGoToOdds = vi.fn();
    const onClose = vi.fn();
    render(<SettingsSheet open onClose={onClose} onGoToOdds={onGoToOdds} onSaveCode={() => {}} />);
    expect(screen.getByText('Save v4 · FY 2 · 12,345 souls lifetime')).toBeInTheDocument();
    expect(screen.getByText(APP_VERSION)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /see requisition odds/i }));
    expect(onGoToOdds).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('restores purchases', async () => {
    seed('no');
    const restorePurchases = vi.fn(async () => {});
    useGame.setState({ restorePurchases });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restore purchases' })); });
    expect(restorePurchases).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/restored/i);
  });

  it('signs in to Play Games and reports the outcome', async () => {
    seed('no');
    useGame.setState({ signInGameServices: vi.fn(async () => true) });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in to Play Games' })); });
    expect(screen.getByRole('status')).toHaveTextContent(/signed in/i);
  });

  it('says when Play Games will not sign in', async () => {
    seed('no');
    useGame.setState({ signInGameServices: vi.fn(async () => false) });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in to Play Games' })); });
    expect(screen.getByRole('status')).toHaveTextContent(/could not sign in/i);
  });

  it('opens the save code sheet', () => {
    seed('no');
    const onSaveCode = vi.fn();
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={onSaveCode} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export or import a save code' }));
    expect(onSaveCode).toHaveBeenCalled();
  });

  it('links the privacy policy', () => {
    seed('no');
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', PRIVACY_URL);
  });
});