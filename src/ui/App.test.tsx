import { act, render, screen, fireEvent } from '@testing-library/react';
import { App } from './App';
import { useGame } from '../store/game';
import { content } from '../data';

/** Every cold boot opens on the splash, then the title, so both are one tap away in every test. */
async function dismissSplash() {
  const splash = await screen.findByTestId('splash');
  fireEvent.click(splash);
}
async function clockIn() {
  const splash = screen.queryByTestId('splash');
  if (splash) fireEvent.click(splash);
  fireEvent.click(await screen.findByRole('button', { name: 'Clock in' }));
}

describe('App shell', () => {
  it('shows the splash before the title, then the title after the splash ends', async () => {
    render(<App />);
    expect(screen.getByTestId('splash')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clock in' })).not.toBeInTheDocument();
    await dismissSplash();
    expect(screen.queryByTestId('splash')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Clock in' })).toBeInTheDocument();
  });

  it('opens on the title screen and only shows the office after clocking in', async () => {
    render(<App />);
    await dismissSplash();
    expect(await screen.findByRole('button', { name: 'Clock in' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: /main/i })).not.toBeInTheDocument();
    await clockIn();
    expect(await screen.findByRole('tab', { name: /office/i })).toBeInTheDocument();
  });

  it('renders five tabs and switches screens', async () => {
    render(<App />);
    await clockIn();
    expect(await screen.findByRole('tab', { name: /office/i })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    fireEvent.click(screen.getByRole('tab', { name: /ledger/i }));
    expect(await screen.findByRole('heading', { name: /fiscal year audit/i })).toBeInTheDocument();
  });

  it('reserves the top safe area on the app shell', async () => {
    render(<App />);
    await clockIn();
    const shell = await screen.findByRole('tablist', { name: /main/i });
    expect(shell.closest('.app')).toHaveClass('safe-area');
  });

  it('unlocks audio on the first pointer down, once', () => {
    const unlock = vi.fn();
    useGame.setState({ audio: { unlock, play: () => {}, setEnabled: () => {}, suspend: () => {}, resume: () => {} } });
    render(<App />);
    fireEvent.pointerDown(document.body);
    fireEvent.pointerDown(document.body);
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('opens the settings sheet from the gear button', async () => {
    render(<App />);
    await clockIn();
    fireEvent.click(await screen.findByRole('button', { name: /settings/i }));
    expect(await screen.findByRole('dialog', { name: /settings/i })).toBeInTheDocument();
  });

  it('opens the Store tab', async () => {
    render(<App />);
    await clockIn();
    fireEvent.click(await screen.findByRole('tab', { name: /store/i }));
    expect(await screen.findByRole('heading', { name: 'Store' })).toBeInTheDocument();
  });

  it('reaches the save code sheet from Settings, closing Settings behind it', async () => {
    render(<App />);
    await clockIn();
    fireEvent.click(await screen.findByRole('button', { name: /settings/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Export or import a save code' }));
    expect(await screen.findByRole('dialog', { name: 'Save code' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('shows the gear on a non-Office tab', async () => {
    render(<App />);
    await clockIn();
    fireEvent.click(await screen.findByRole('tab', { name: /tasks/i }));
    fireEvent.click(await screen.findByRole('button', { name: /settings/i }));
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('applies data-theme from settings and removes it for system', async () => {
    render(<App />);
    await clockIn();
    act(() => { useGame.getState().setTheme('dark'); });
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    act(() => { useGame.getState().setTheme('system'); });
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    act(() => { useGame.getState().setTheme('light'); });
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('reaches the requisition odds from the title screen footer', async () => {
    render(<App />);
    await dismissSplash();
    fireEvent.click(await screen.findByRole('button', { name: 'Odds' }));
    expect(await screen.findByRole('tab', { name: /personnel/i })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('App onboarding', () => {
  it('opens the intro over the office and keeps the notification prompt away', async () => {
    render(<App />);
    await clockIn();
    expect(await screen.findByRole('dialog', { name: 'Introduction' })).toBeInTheDocument();
    // Two days of play would otherwise satisfy shouldAskNotifications; the unseen intro wins.
    const state = useGame.getState().state;
    useGame.setState({ state: { ...state, settings: { ...state.settings, notifOptIn: 'unasked' }, firstSeenWallClock: Date.now() - 3 * 86_400_000 } });
    expect(screen.queryByRole('dialog', { name: 'Reminders' })).not.toBeInTheDocument();
  });

  it('runs the intro into the training coach marks', async () => {
    render(<App />);
    await clockIn();
    await screen.findByRole('dialog', { name: 'Introduction' });
    for (let i = 0; i < content.onboarding.intro.length - 1; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    fireEvent.click(screen.getByRole('button', { name: content.onboarding.intro[3].cta }));
    expect(await screen.findByText(content.onboarding.training[0].title)).toBeInTheDocument();
  });

  it('shows neither intro nor training on a save that has been through both', async () => {
    render(<App />);
    await dismissSplash();
    await screen.findByRole('button', { name: 'Clock in' });
    const state = useGame.getState().state;
    useGame.setState({ state: { ...state, onboarding: { memosSeen: true, trainingStep: 3 } } });
    await clockIn();
    await screen.findByRole('tab', { name: /office/i });
    expect(screen.queryByRole('dialog', { name: 'Introduction' })).not.toBeInTheDocument();
    expect(screen.queryByText(content.onboarding.training[0].title)).not.toBeInTheDocument();
  });
});
