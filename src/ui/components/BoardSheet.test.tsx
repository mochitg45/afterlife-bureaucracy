import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BoardSheet } from './BoardSheet';

const view = {
  top: [
    { name: 'CptMorgahn', souls: '3.3e12', me: false },
    { name: 'miketg45', souls: '8.45e14', me: true },
  ],
  rank: 2,
  total: 43,
};

describe('BoardSheet', () => {
  it('shows real formatted numbers, names, and the player place', async () => {
    const load = vi.fn().mockResolvedValue(true);
    render(<BoardSheet title="Lifetime souls" view={view} load={load} onClose={() => {}} />);
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(screen.getByText('CptMorgahn')).toBeInTheDocument();
    expect(screen.getByText(/845/)).toBeInTheDocument();
    expect(screen.getByText(/#2/)).toBeInTheDocument();
    expect(document.querySelector('.board-row.me')).not.toBeNull();
  });

  it('says so when the board cannot load', async () => {
    render(<BoardSheet title="x" view={null} load={() => Promise.resolve(false)} onClose={() => {}} />);
    expect(await screen.findByText(/connection/i)).toBeInTheDocument();
  });
});
