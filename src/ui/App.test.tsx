import { render, screen, fireEvent } from '@testing-library/react';
import { App } from './App';

describe('App shell', () => {
  it('renders five tabs and switches screens', async () => {
    render(<App />);
    expect(await screen.findByRole('tab', { name: /office/i })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    fireEvent.click(screen.getByRole('tab', { name: /ledger/i }));
    expect(await screen.findByRole('heading', { name: /fiscal year audit/i })).toBeInTheDocument();
  });

  it('reserves the top safe area on the app shell', async () => {
    render(<App />);
    const shell = await screen.findByRole('tablist', { name: /main/i });
    expect(shell.closest('.app')).toHaveClass('safe-area');
  });

  it('opens the settings sheet from the gear button', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /settings/i }));
    expect(await screen.findByRole('dialog', { name: /settings/i })).toBeInTheDocument();
  });
});
