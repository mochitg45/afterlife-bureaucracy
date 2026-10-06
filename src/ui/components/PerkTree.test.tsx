import { render, screen, fireEvent } from '@testing-library/react';
import { PerkTree } from './PerkTree';
import { useGame } from '../../store/game';
import { createInitialState, type GameState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(patch: Partial<GameState>) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }, content), ...patch };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true });
}
const branches = [...new Set(content.perks.map((p) => p.branch))];
const openBranch = (id: string) => fireEvent.click(screen.getByTestId(`perk-branch-${id}`));

describe('PerkTree', () => {
  it('draws one node per perk across the branches', () => {
    seed({});
    const { unmount } = render(<PerkTree />);
    let nodes = 0;
    for (const b of branches) {
      fireEvent.click(screen.getByTestId(`perk-tab-${b}`));
      nodes += document.querySelectorAll('.pt-node').length;
    }
    expect(nodes).toBe(content.perks.length);
    unmount();
  });

  it('shows the overview first, with branch progress, and opens a branch from it', () => {
    seed({ perks: ['throughput-1'] });
    render(<PerkTree />);
    expect(screen.getByRole('button', { name: /^Throughput, 1 of 12 perks owned/ })).toBeInTheDocument();
    openBranch('throughput');
    expect(screen.getByTestId('perk-node-throughput-1')).toBeInTheDocument();
  });

  it('marks owned, buyable, unaffordable and locked nodes', () => {
    seed({ seals: 12, perks: ['throughput-1'] });
    render(<PerkTree />);
    openBranch('throughput');
    expect(screen.getByTestId('perk-node-throughput-1')).toHaveAttribute('data-status', 'owned');
    expect(screen.getByTestId('perk-node-throughput-2')).toHaveAttribute('data-status', 'available'); // 12 seals
    expect(screen.getByTestId('perk-node-throughput-4')).toHaveAttribute('data-status', 'unaffordable'); // 18 seals
    expect(screen.getByTestId('perk-node-throughput-3')).toHaveAttribute('data-status', 'locked');
    expect(screen.getByRole('button', { name: /^Two-Sided Forms, ready to buy, 12 seals/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pneumatic Tubes, locked/ })).toBeInTheDocument();
  });

  it('buys through the detail sheet', () => {
    seed({ seals: 12, perks: ['throughput-1'] });
    render(<PerkTree />);
    openBranch('throughput');
    fireEvent.click(screen.getByTestId('perk-node-throughput-2'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('perk-buy'));
    const s = useGame.getState().state;
    expect(s.perks).toContain('throughput-2');
    expect(s.seals).toBe(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('disables Buy on a locked perk and says what it needs', () => {
    seed({ seals: 500 });
    render(<PerkTree />);
    openBranch('throughput');
    fireEvent.click(screen.getByTestId('perk-node-throughput-2'));
    const buy = screen.getByTestId('perk-buy');
    expect(buy).toBeDisabled();
    expect(buy).toHaveTextContent('Locked: needs Stamped Memo Pads');
    fireEvent.click(buy);
    expect(useGame.getState().state.perks).toEqual([]);
  });

  it('shows the level badge on owned upgradable nodes and glows only when an upgrade is affordable', () => {
    seed({ seals: 6, perks: ['throughput-1', 'throughput-2'], perkLevels: { 'throughput-2': 3 } });
    render(<PerkTree />);
    openBranch('throughput');
    expect(screen.getByTestId('perk-level-throughput-1')).toHaveTextContent('Lv 1');
    expect(screen.getByTestId('perk-level-throughput-2')).toHaveTextContent('Lv 3');
    expect(screen.getByTestId('perk-node-throughput-1')).toHaveClass('upgradable'); // costs 6
    expect(screen.getByTestId('perk-node-throughput-2')).not.toHaveClass('upgradable'); // costs 48
    expect(screen.queryByTestId('perk-level-throughput-3')).not.toBeInTheDocument();
  });

  it('upgrades through the detail sheet, showing now, next and the price', () => {
    seed({ seals: 20, perks: ['throughput-1'] });
    render(<PerkTree />);
    openBranch('throughput');
    fireEvent.click(screen.getByTestId('perk-node-throughput-1'));
    const sheet = screen.getByTestId('perk-levels');
    expect(sheet).toHaveTextContent('All output +10%');
    expect(sheet).toHaveTextContent('All output +12.5%');
    expect(sheet).toHaveTextContent('6 (you have 20)');
    fireEvent.click(screen.getByTestId('perk-upgrade'));
    const s = useGame.getState().state;
    expect(s.perkLevels['throughput-1']).toBe(2);
    expect(s.seals).toBe(14);
    expect(screen.getByTestId('perk-levels')).toHaveTextContent('Level2 / 10');
  });

  it('disables Upgrade when short of seals or at the max level, with the reason', () => {
    seed({ seals: 2, perks: ['throughput-1'] });
    const { unmount } = render(<PerkTree />);
    openBranch('throughput');
    fireEvent.click(screen.getByTestId('perk-node-throughput-1'));
    expect(screen.getByTestId('perk-upgrade')).toBeDisabled();
    expect(screen.getByTestId('perk-upgrade')).toHaveTextContent('Need 4 more seals');
    unmount();
    seed({ seals: 1e6, perks: ['throughput-1'], perkLevels: { 'throughput-1': 10 } });
    render(<PerkTree />);
    openBranch('throughput');
    fireEvent.click(screen.getByTestId('perk-node-throughput-1'));
    expect(screen.getByTestId('perk-upgrade')).toBeDisabled();
    expect(screen.getByTestId('perk-upgrade')).toHaveTextContent('Max level');
  });

  it('disables Buy when the player is short of seals', () => {
    seed({ seals: 2 });
    render(<PerkTree />);
    openBranch('throughput');
    fireEvent.click(screen.getByTestId('perk-node-throughput-1'));
    expect(screen.getByTestId('perk-buy')).toBeDisabled();
    expect(screen.getByTestId('perk-buy')).toHaveTextContent('Need 4 more seals');
  });
});
