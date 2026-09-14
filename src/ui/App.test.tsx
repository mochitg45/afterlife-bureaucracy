import { render, screen, fireEvent } from '@testing-library/react';
import { App } from './App';

describe('App shell', () => {
  it('renders five tabs and switches screens', async () => {
    render(<App />);
    expect(await screen.findByRole('tab', { name: /office/i })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    fireEvent.click(screen.getByRole('tab', { name: /ledger/i }));
    expect(await screen.findByRole('heading', { name: /^ledger$/i })).toBeInTheDocument();
  });
});
