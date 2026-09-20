import { render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { PullReveal } from './PullReveal';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';
import type { PullResult } from '../../engine/gacha';

function seed(pendingPull: PullResult[] | null) {
  const state = createInitialState({ wall: 0, mono: 0 }, content);
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, pendingPull });
}

describe('PullReveal', () => {
  it('renders nothing when there is no pending pull', () => {
    seed(null);
    const { container } = render(<PullReveal />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows NEW, duplicate KC, foil executives and guaranteed pity, and dismisses on Back to Personnel', () => {
    seed([
      { cardId: 'c-dave-overtime', rarity: 'temp', starsAfter: 1, duplicateKc: null, pityTriggered: null, shards: 0, shardsNeeded: 1 },
      { cardId: 'c-keeper', rarity: 'executive', starsAfter: 5, duplicateKc: new Decimal(6000), pityTriggered: 'executive', shards: 0, shardsNeeded: 0 },
    ]);
    render(<PullReveal />);
    const dialog = screen.getByRole('dialog', { name: /requisition results/i });
    expect(screen.getByText('NEW')).toBeInTheDocument();
    expect(screen.getByText('+6,000 KC')).toBeInTheDocument();
    expect(screen.getByText('Guaranteed')).toBeInTheDocument();
    expect(dialog.querySelector('.foil')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to personnel/i }));
    expect(useGame.getState().pendingPull).toBeNull();
  });
});
