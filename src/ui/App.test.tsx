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

  it('opens the Store tab', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('tab', { name: /store/i }));
    expect(await screen.findByRole('heading', { name: 'Store' })).toBeInTheDocument();
  });

  it('reaches the save code sheet from Settings, closing Settings behind it', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /settings/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Export or import a save code' }));
    expect(await screen.findByRole('dialog', { name: 'Save code' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('shows the gear on a non-Office tab', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('tab', { name: /tasks/i }));
    fireEvent.click(await screen.findByRole('button', { name: /settings/i }));
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });
});