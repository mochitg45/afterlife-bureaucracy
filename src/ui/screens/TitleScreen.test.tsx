import { act, render, screen, fireEvent } from '@testing-library/react';
import { TitleScreen } from './TitleScreen';
import { useGame } from '../../store/game';
import type { SignInResult } from '../../platform/cloudSave';
import { APP_VERSION, PRIVACY_URL } from '../../version';

function seedCloud(cloud: { available: boolean; signedIn: boolean }) {
  useGame.setState({
    ready: true,
    cloud: { available: cloud.available, signedIn: cloud.signedIn, syncing: false, lastSyncWall: 0, lastResult: 'none' },
  });
}

function stubSignIn(result: SignInResult) {
  const signInCloud = vi.fn(async (): Promise<SignInResult> => result);
  useGame.setState({ signInCloud });
  return signInCloud;
}

describe('TitleScreen', () => {
  it('offers the Play Games sign-in when the cloud is available and nobody is signed in', () => {
    seedCloud({ available: true, signedIn: false });
    render(<TitleScreen onEnter={() => {}} onGoToOdds={() => {}} />);
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play as guest' })).toBeInTheDocument();
  });

  it('hides the sign-in button where there is no cloud slot', () => {
    seedCloud({ available: false, signedIn: false });
    render(<TitleScreen onEnter={() => {}} onGoToOdds={() => {}} />);
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clock in' })).toBeInTheDocument();
  });

  it('shows the signed-in chip and no sign-in button once signed in', () => {
    seedCloud({ available: true, signedIn: true });
    render(<TitleScreen onEnter={() => {}} onGoToOdds={() => {}} />);
    expect(screen.getByText('Signed in with Google')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in with/i })).not.toBeInTheDocument();
  });

  it('enters the office on Clock in', () => {
    seedCloud({ available: false, signedIn: false });
    const onEnter = vi.fn();
    render(<TitleScreen onEnter={onEnter} onGoToOdds={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clock in' }));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('enters the office after a successful sign-in', async () => {
    seedCloud({ available: true, signedIn: false });
    const signInCloud = stubSignIn('ok');
    const onEnter = vi.fn();
    render(<TitleScreen onEnter={onEnter} onGoToOdds={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' })); });
    expect(signInCloud).toHaveBeenCalled();
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('reports a cancelled sign-in and stays on the title screen', async () => {
    seedCloud({ available: true, signedIn: false });
    stubSignIn('cancelled');
    const onEnter = vi.fn();
    render(<TitleScreen onEnter={onEnter} onGoToOdds={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' })); });
    expect(screen.getByRole('status')).toHaveTextContent('Sign-in cancelled.');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('reports a device without Play Games and stays on the title screen', async () => {
    seedCloud({ available: true, signedIn: false });
    stubSignIn('unavailable');
    const onEnter = vi.fn();
    render(<TitleScreen onEnter={onEnter} onGoToOdds={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' })); });
    expect(screen.getByRole('status')).toHaveTextContent('Play Games is not available on this device.');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('shows the version, the privacy link and the odds button in the footer', () => {
    seedCloud({ available: false, signedIn: false });
    const onGoToOdds = vi.fn();
    render(<TitleScreen onEnter={() => {}} onGoToOdds={onGoToOdds} />);
    expect(screen.getByText('v' + APP_VERSION)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', PRIVACY_URL);
    fireEvent.click(screen.getByRole('button', { name: 'Odds' }));
    expect(onGoToOdds).toHaveBeenCalled();
  });
});
