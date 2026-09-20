import { render, screen, fireEvent } from '@testing-library/react';
import { CardSheet } from './CardSheet';
import { useGame } from '../../store/game';
import { createInitialState, type GameState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

const CARD = 'c-dave-overtime'; // deptMult 0.05 on intake

function seed(patch: Partial<GameState>) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }, content), ...patch };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true });
}

describe('CardSheet', () => {
  it('opens with the card name and bonus line', () => {
    seed({ cards: { [CARD]: 1 } });
    render(<CardSheet cardId={CARD} onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Dave')).toBeInTheDocument();
    expect(screen.getByText(/bonus now: \+5% intake output/i)).toBeInTheDocument();
  });

  it('calls equip on Equip', () => {
    seed({ cards: { [CARD]: 1 } });
    render(<CardSheet cardId={CARD} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /equip/i }));
    expect(useGame.getState().state.equipped).toEqual([CARD]);
  });

  it('shows Unequip when already equipped and calls unequip', () => {
    seed({ cards: { [CARD]: 1 }, equipped: [CARD] });
    render(<CardSheet cardId={CARD} onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: /unequip/i });
    fireEvent.click(btn);
    expect(useGame.getState().state.equipped).toEqual([]);
  });

  it('disables Equip and says why when slots are full', () => {
    // BASE_EQUIP_SLOTS is 3; fill them all with cards other than CARD.
    const owned = content.cards.filter((c) => c.id !== CARD).slice(0, 3).map((c) => c.id);
    seed({
      cards: { [CARD]: 1, ...Object.fromEntries(owned.map((id) => [id, 1])) },
      equipped: owned,
    });
    render(<CardSheet cardId={CARD} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /equip/i })).toBeDisabled();
    expect(screen.getByText(/no free lanyard/i)).toBeInTheDocument();
  });

  it('shows duplicate progress toward the next star', () => {
    seed({ cards: { [CARD]: 1 }, cardShards: { [CARD]: 1 } });
    render(<CardSheet cardId={CARD} onClose={() => {}} />);
    expect(screen.getByText(/1 of 1 duplicates to ★2/i)).toBeInTheDocument();
  });

  it('shows Max stars at the cap', () => {
    seed({ cards: { [CARD]: 5 } });
    render(<CardSheet cardId={CARD} onClose={() => {}} />);
    expect(screen.getByText(/max stars/i)).toBeInTheDocument();
  });
});
