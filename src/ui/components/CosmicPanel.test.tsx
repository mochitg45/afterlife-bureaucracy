import { render, screen, fireEvent } from '@testing-library/react';
import { CosmicPanel } from './CosmicPanel';
import { useGame } from '../../store/game';
import { createInitialState, type GameState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';
import { COSMIC_THRESHOLD } from '../../engine/cosmic';

const ROOT = content.clauses[0];              // clause-throughput-1, no prerequisites
const GATED = content.clauses.find((c) => c.requires.length > 0)!;

function seed(patch: Partial<GameState>) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }, content), ...patch };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, lastCosmic: null });
}

describe('CosmicPanel', () => {
  it('shows the locked state with progress below the threshold', () => {
    seed({ seals: 40 });
    render(<CosmicPanel />);
    expect(screen.getByText(/unlocks at 100 seals/i)).toBeInTheDocument();
    expect(screen.getByText(`40 / ${COSMIC_THRESHOLD} Seals`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restructure/i })).not.toBeInTheDocument();
  });

  it('restructures behind a two-step confirm that lists what resets', () => {
    seed({ seals: COSMIC_THRESHOLD, perks: ['throughput-1'], staff: { dave: 3 } });
    render(<CosmicPanel />);
    const button = screen.getByRole('button', { name: 'Restructure (+1 Clause point)' });
    fireEvent.click(button);
    expect(useGame.getState().state.cosmicPoints).toBe(0);
    expect(screen.getByText(/seals, every perk/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restructure (+1 Clause point)' }));
    const after = useGame.getState().state;
    expect(after.cosmicPoints).toBe(1);
    expect(after.seals).toBe(0);
    expect(after.perks).toEqual([]);
    expect(after.staff).toEqual({});
    expect(useGame.getState().lastCosmic).toEqual({ pointsGained: 1 });
  });

  it('cancels the confirm without restructuring', () => {
    seed({ seals: COSMIC_THRESHOLD });
    render(<CosmicPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Restructure (+1 Clause point)' }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/seals, every perk/i)).not.toBeInTheDocument();
    expect(useGame.getState().state.cosmicPoints).toBe(0);
  });

  it('enacts an affordable clause and leaves gated ones disabled', () => {
    seed({ cosmicPoints: 1 });
    render(<CosmicPanel />);
    expect(screen.getByText('Clause points: 1')).toBeInTheDocument();
    const gated = screen.getByRole('button', { name: `Enact ${GATED.name}` });
    expect(gated).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: `Enact ${ROOT.name}` }));
    expect(useGame.getState().state.cosmicClauses).toEqual([ROOT.id]);
    expect(useGame.getState().state.cosmicPoints).toBe(0);
  });

  it('marks an enacted clause and disables its button', () => {
    seed({ cosmicPoints: 1, cosmicClauses: [ROOT.id] });
    render(<CosmicPanel />);
    expect(screen.getByRole('button', { name: `Enact ${ROOT.name}` })).toBeDisabled();
    expect(screen.getByText('ENACTED')).toBeInTheDocument();
  });

  it('disables every clause without a point to spend', () => {
    seed({ cosmicPoints: 0 });
    render(<CosmicPanel />);
    expect(screen.getByRole('button', { name: `Enact ${ROOT.name}` })).toBeDisabled();
  });
});
