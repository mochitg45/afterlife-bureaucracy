import { useGame } from '../../store/game';
import { content } from '../../data';
import { findCard } from '../../engine/content';
import { DUPES_PER_STAR, MAX_STARS, equipSlots } from '../../engine/gacha';
import { RARITY_LABEL } from '../components/CardTile';
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

  const card = findCard(content, cardId);
  const stars = cards[cardId] ?? 1;
  const isEquipped = equipped.includes(cardId);
  const slots = equipSlots({ perks }, content);
  const full = !isEquipped && equipped.length >= slots;
  const shards = useGame((s) => s.state.cardShards[cardId] ?? 0);

  return (
    <Modal open title={card.name} label={`${card.name}, ${card.title}`} onClose={onClose}>
      <div className="card-sheet-head">
        <Character id={card.character} mood="ok" size={96} />
        <span className="sub">{card.title}</span>
        <span className="sub">{RARITY_LABEL[card.rarity]}</span>
        <span className="tile-stars mono" aria-label={`${stars} stars`}>{'★'.repeat(Math.max(0, stars))}</span>
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
    </Modal>
  );
}
