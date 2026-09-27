import { useState } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { findCard } from '../../engine/content';
import { DUPES_PER_STAR, MAX_STARS, equipSlots, EXCHANGE_COST, EXCHANGE_CHANCE, type ExchangeResult } from '../../engine/gacha';
import { formatNumber } from '../../engine/format';
import { RARITY_LABEL } from '../components/CardTile';
import { Stars } from '../components/Stars';
import { Character } from '../characters/Character';
import { Modal } from '../components/Modal';

/** Formats a percentage bonus with the tenths-of-a-percent rounding the rest of the UI uses. */
function pct(value: number): string {
  const tenths = Math.round(value * 1000) / 10;
  return (Number.isInteger(tenths) ? tenths.toString() : tenths.toFixed(1)) + '%';
}

/** The per-card contribution at a given star count — same `value * stars` the equipped-card
 * sums in gacha.ts (cardGlobalMult/cardDeptMult/sumEffect) use, kept in sync by inspection. */
function bonusLine(card: ReturnType<typeof findCard>, stars: number): string {
  const effect = card.effect;
  const amount = effect.value * stars;
  switch (effect.type) {
    case 'deptMult': {
      const dept = content.departments.find((d) => d.id === effect.dept);
      return `+${pct(amount)} ${dept?.name ?? effect.dept} output`;
    }
    case 'globalMult':
      return `+${pct(amount)} all income`;
    case 'clickMult':
      return `+${pct(amount)} per stamp`;
    case 'offlineCapHours':
      return `+${amount}h offline cap`;
    case 'voucherMult':
      return `+${pct(amount)} voucher grants`;
  }
}

export function CardSheet({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const cards = useGame((s) => s.state.cards);
  const equipped = useGame((s) => s.state.equipped);
  const perks = useGame((s) => s.state.perks);
  const equip = useGame((s) => s.equip);
  const unequip = useGame((s) => s.unequip);
  const exchange = useGame((s) => s.exchange);
  const [outcome, setOutcome] = useState<ExchangeResult | null>(null);

  const card = findCard(content, cardId);
  const stars = cards[cardId] ?? 1;
  const isEquipped = equipped.includes(cardId);
  const slots = equipSlots({ perks }, content);
  const full = !isEquipped && equipped.length >= slots;
  const shards = useGame((s) => s.state.cardShards[cardId] ?? 0);
  const spares = useGame((s) => s.state.cardSpares[cardId] ?? 0);
  const canExchange = stars >= MAX_STARS && card.rarity !== 'executive' && spares >= EXCHANGE_COST;

  return (
    <Modal open title={card.name} label={`${card.name}, ${card.title}`} onClose={onClose}>
      <div className="card-sheet-head">
        <Character id={card.character} art={card.id} mood="ok" size={96} />
        <span className="sub">{card.title}</span>
        <span className="sub">{RARITY_LABEL[card.rarity]}</span>
        <Stars stars={stars} className="tile-stars" />
        {stars < MAX_STARS ? (
          <span className="sub">{shards} of {DUPES_PER_STAR[stars - 1]} duplicates to ★{stars + 1}</span>
        ) : (
          <span className="sub">Max stars</span>
        )}
      </div>
      <p>{card.flavor}</p>
      <p>Bonus now: {bonusLine(card, stars)}</p>
      {stars < MAX_STARS && <p>Next star: {bonusLine(card, stars + 1)}</p>}
      <div className="modal-actions">
        <button
          className="btn btn-primary"
          disabled={full}
          onClick={() => {
            if (isEquipped) unequip(cardId); else equip(cardId);
            onClose();
          }}
        >
          {isEquipped ? 'Unequip' : 'Equip'}
        </button>
        {full && <span className="sub warn">No free lanyard</span>}
      </div>
      {canExchange && (
        <div className="modal-actions">
          <button className="btn" onClick={() => setOutcome(exchange(cardId))}>
            Exchange {EXCHANGE_COST} spares ({pct(EXCHANGE_CHANCE[card.rarity as 'temp' | 'fulltime' | 'senior'])} chance)
          </button>
          <span className="sub">{spares} spare{spares === 1 ? '' : 's'}</span>
        </div>
      )}
      {outcome && (
        <p className="sub brass">
          {outcome.success
            ? `Exchanged: got ${findCard(content, outcome.cardId as string).name}!`
            : `No luck: +${formatNumber(outcome.duplicateKc as NonNullable<typeof outcome.duplicateKc>)} KC`}
        </p>
      )}
    </Modal>
  );
}
