import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CardSheet } from './CardSheet';
import { useGame } from '../../store/game';
import { createInitialState, type GameState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';
import { nextFloat } from '../../engine/rng';
import {
  cardGlobalMult,
  cardDeptMult,
  cardClickMult,
  cardOfflineCapHours,
  cardVoucherMult,
  EXCHANGE_COST,
  EXCHANGE_CHANCE,
} from '../../engine/gacha';

/** Brute-forces a seed whose next roll lands on the wanted side of `chance` (mirrors gacha.test.ts). */
function seedFor(chance: number, wantSuccess: boolean): number {
  for (let seed = 1; seed < 10_000; seed++) {
    if ((nextFloat(seed).value < chance) === wantSuccess) return seed;
  }
  throw new Error('no seed found in range');
}

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
    expect(screen.getByText(/1 of 2 duplicates to ★2/i)).toBeInTheDocument();
  });

  it('shows Max stars at the cap', () => {
    seed({ cards: { [CARD]: 5 } });
    render(<CardSheet cardId={CARD} onClose={() => {}} />);
    expect(screen.getByText(/max stars/i)).toBeInTheDocument();
  });

  it('shows 5 filled stars at the cap with the 5-of-5 label', () => {
    seed({ cards: { [CARD]: 5 } });
    render(<CardSheet cardId={CARD} onClose={() => {}} />);
    expect(screen.getByLabelText('5 of 5 stars')).toBeInTheDocument();
  });

  it('hides the Exchange button below EXCHANGE_COST spares, below ★5, or for an executive card', () => {
    seed({ cards: { [CARD]: 5 }, cardSpares: { [CARD]: EXCHANGE_COST - 1 } });
    render(<CardSheet cardId={CARD} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: /exchange/i })).toBeNull();
    cleanup();

    seed({ cards: { [CARD]: 4 }, cardSpares: { [CARD]: EXCHANGE_COST } });
    render(<CardSheet cardId={CARD} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: /exchange/i })).toBeNull();
    cleanup();

    const exec = content.cards.find((c) => c.rarity === 'executive')!.id;
    seed({ cards: { [exec]: 5 }, cardSpares: { [exec]: EXCHANGE_COST } });
    render(<CardSheet cardId={exec} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: /exchange/i })).toBeNull();
  });

  it('exchanges spares for a chance at the next rarity and shows the result', () => {
    const winSeed = seedFor(EXCHANGE_CHANCE.temp, true);
    seed({ cards: { [CARD]: 5 }, cardSpares: { [CARD]: EXCHANGE_COST }, rngSeed: winSeed });
    render(<CardSheet cardId={CARD} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /exchange 3 spares/i }));
    expect(useGame.getState().state.cardSpares[CARD]).toBe(0);
    expect(screen.getByText(/exchanged: got/i)).toBeInTheDocument();
  });

  it('shows a consolation KC line on a failed exchange', () => {
    const loseSeed = seedFor(EXCHANGE_CHANCE.temp, false);
    seed({ cards: { [CARD]: 5 }, cardSpares: { [CARD]: EXCHANGE_COST }, rngSeed: loseSeed });
    render(<CardSheet cardId={CARD} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /exchange 3 spares/i }));
    expect(screen.getByText(/no luck: \+[\d,]+ kc/i)).toBeInTheDocument();
  });

  it('prints the bonus the engine would actually apply, for every card at every star', () => {
    // The sheet's bonusLine() re-does the `value * stars` maths that gacha.ts's multipliers
    // do, and the two were only kept in step by inspection. This walks all 30 cards at stars
    // 1-5 and checks the printed number against what equipping that card really pays.
    for (const card of content.cards) {
      for (let stars = 1; stars <= 5; stars++) {
        seed({ cards: { [card.id]: stars }, equipped: [card.id] });
        const state = useGame.getState().state;
        const e = card.effect;
        const amount =
          e.type === 'globalMult' ? cardGlobalMult(state, content).toNumber() - 1
          : e.type === 'deptMult' ? cardDeptMult(state, content, e.dept).toNumber() - 1
          : e.type === 'clickMult' ? cardClickMult(state, content)
          : e.type === 'offlineCapHours' ? cardOfflineCapHours(state, content)
          : cardVoucherMult(state, content);
        const tenths = Math.round(amount * 1000) / 10;
        const shown = e.type === 'offlineCapHours'
          ? `+${amount}h`
          : '+' + (Number.isInteger(tenths) ? tenths.toString() : tenths.toFixed(1)) + '%';
        render(<CardSheet cardId={card.id} onClose={() => {}} />);
        expect(
          screen.getByText((_, el) => el?.textContent?.startsWith(`Bonus now: ${shown}`) === true, { selector: 'p' }),
        ).toBeInTheDocument();
        cleanup();
      }
    }
  });
});
