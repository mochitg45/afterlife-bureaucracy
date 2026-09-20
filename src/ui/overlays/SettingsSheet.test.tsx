import { act, render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { SettingsSheet } from './SettingsSheet';
import { useGame, type RestoreResult } from '../../store/game';
import type { CloudSyncResult } from '../../engine/cloudSync';
import type { SignInResult } from '../../platform/cloudSave';
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

function seedCloud(cloud: Partial<{ available: boolean; signedIn: boolean; syncing: boolean; lastSyncWall: number; lastResult: CloudSyncResult }>) {
  useGame.setState({
    cloud: { available: false, signedIn: false, syncing: false, lastSyncWall: 0, lastResult: 'none', ...cloud },
  });
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
    const restorePurchases = vi.fn(async (): Promise<RestoreResult> => 'ok');
    useGame.setState({ restorePurchases });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restore purchases' })); });
    expect(restorePurchases).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Purchases restored.');
  });

  // The three outcomes are deliberately different sentences: "you own nothing here" and "the
  // store never answered" are not the same news.
  it('says when the account owns nothing to restore', async () => {
    seed('no');
    useGame.setState({ restorePurchases: vi.fn(async (): Promise<RestoreResult> => 'none') });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restore purchases' })); });
    expect(screen.getByRole('status')).toHaveTextContent('Nothing to restore for this account.');
  });

  it('says when the store did not answer', async () => {
    seed('no');
    useGame.setState({ restorePurchases: vi.fn(async (): Promise<RestoreResult> => 'error') });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restore purchases' })); });
    expect(screen.getByRole('status')).toHaveTextContent('The store did not respond. Try again later.');
  });

  it('says the platform has no cloud slot at all', () => {
    seed('no');
    seedCloud({ available: false });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    expect(screen.getByText('Not available on this platform')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('offers a cloud sign-in when the slot is there and nobody is signed in', async () => {
    seed('no');
    seedCloud({ available: true });
    const signInCloud = vi.fn(async (): Promise<SignInResult> => 'ok');
    useGame.setState({ signInCloud });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    expect(screen.getByText('Not signed in')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in' })); });
    expect(signInCloud).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/signed in to play games/i);
  });

  it('leaves every sync action closed until someone is signed in', () => {
    seed('no');
    seedCloud({ available: true });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    // Each would only come back with "not available here", which is not what is wrong.
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Upload this device' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Restore from cloud' })).toBeDisabled();
    expect(screen.getByText('Sign in to sync.')).toBeInTheDocument();
  });

  it('says when Play Games will not sign in', async () => {
    seed('no');
    seedCloud({ available: true });
    useGame.setState({ signInCloud: vi.fn(async (): Promise<SignInResult> => 'unavailable') });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in' })); });
    expect(screen.getByRole('status')).toHaveTextContent(/not available on this device/i);
  });

  it('shows how long ago the last sync landed', () => {
    seed('no');
    seedCloud({ available: true, signedIn: true, lastSyncWall: Date.now() - 5 * 60_000, lastResult: 'uploaded' });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    expect(screen.getByText('Synced 5 min ago')).toBeInTheDocument();
  });

  it('says when the last sync failed', () => {
    seed('no');
    seedCloud({ available: true, signedIn: true, lastSyncWall: Date.now(), lastResult: 'error' });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    expect(screen.getByText('Sync failed')).toBeInTheDocument();
  });

  it('syncs on demand', async () => {
    seed('no');
    seedCloud({ available: true, signedIn: true });
    const syncCloud = vi.fn(async (): Promise<CloudSyncResult> => 'uploaded');
    useGame.setState({ syncCloud });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sync now' })); });
    expect(syncCloud).toHaveBeenCalledWith('manual');
    expect(screen.getByRole('status')).toHaveTextContent('Uploaded this device to the cloud.');
  });

  // Both overrides throw away one of the two saves, so neither is ever one stray tap away.
  it('takes two taps to restore from the cloud', async () => {
    seed('no');
    seedCloud({ available: true, signedIn: true });
    const restoreCloud = vi.fn(async (): Promise<CloudSyncResult> => 'downloaded');
    useGame.setState({ restoreCloud });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore from cloud' }));
    expect(restoreCloud).not.toHaveBeenCalled();
    // The armed button renames itself, so its accessible name says what the next tap does.
    expect(screen.queryByRole('button', { name: 'Restore from cloud' })).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm restore' })); });
    expect(restoreCloud).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Restored this device from the cloud.');
  });

  it('takes two taps to upload this device', async () => {
    seed('no');
    seedCloud({ available: true, signedIn: true });
    const uploadLocal = vi.fn(async (): Promise<CloudSyncResult> => 'uploaded');
    useGame.setState({ uploadLocal });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Upload this device' }));
    expect(uploadLocal).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm upload' })); });
    expect(uploadLocal).toHaveBeenCalledTimes(1);
  });

  // One confirm at a time: arming the upload must disarm a restore the player left armed.
  it('cancels a pending confirm when the other override is armed', () => {
    seed('no');
    seedCloud({ available: true, signedIn: true });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore from cloud' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload this device' }));
    expect(screen.queryByRole('button', { name: 'Confirm restore' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm upload' })).toBeInTheDocument();
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