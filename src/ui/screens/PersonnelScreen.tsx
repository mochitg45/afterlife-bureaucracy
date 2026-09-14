import { useState } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { findCard } from '../../engine/content';
import type { Rarity } from '../../engine/content';
import { PITY_SENIOR, PITY_EXECUTIVE, PULL_COST, TEN_PULL_COST, ODDS, equipSlots } from '../../engine/gacha';
import { CardTile, RARITY_LABEL } from '../components/CardTile';

/** How long the "No free lanyard" nudge stays up after a blocked equip attempt. */
const NO_LANYARD_MS = 2000;

const RARITY_ORDER: Rarity[] = ['temp', 'fulltime', 'senior', 'executive'];

/** ODDS is a fraction (0.065); the odds card needs "6.5%" without float noise (0.065 * 100 !== 6.5 exactly). */
function pct(value: number): string {
  const tenths = Math.round(value * 1000) / 10;
  return (Number.isInteger(tenths) ? tenths.toString() : tenths.toFixed(1)) + '%';
}

export function PersonnelScreen() {
  const state = useGame((s) => s.state);
  const pull = useGame((s) => s.pull);
  const equip = useGame((s) => s.equip);
  const unequip = useGame((s) => s.unequip);
  const [showNoLanyard, setShowNoLanyard] = useState(false);

  const { vouchers, pity, cards, equipped } = state;
  const slots = equipSlots(state, content);

  const flashNoLanyard = () => {
    setShowNoLanyard(true);
    setTimeout(() => setShowNoLanyard(false), NO_LANYARD_MS);
  };

  const onCollectionClick = (cardId: string) => {
    if (equipped.includes(cardId)) { unequip(cardId); return; }
    if (equipped.length >= slots) { flashNoLanyard(); return; }
    equip(cardId);
  };

  return (
    <section className="screen personnel">
      <h2 className="visually-hidden">Personnel</h2>
      <header className="card">
        <div className="label">Requisition Vouchers</div>
        <div className="mono value brass">{vouchers} ◇</div>
        <p className="sub">Senior guaranteed in {PITY_SENIOR - pity.senior}</p>
        <p className="sub">Executive guaranteed in {PITY_EXECUTIVE - pity.executive}</p>
        <div className="modal-actions">
          <button className="btn" disabled={vouchers < PULL_COST} onClick={() => pull(1)} aria-label="Draw one requisition">
            {PULL_COST} ◇
          </button>
          <button className="btn btn-primary" disabled={vouchers < TEN_PULL_COST} onClick={() => pull(10)} aria-label="Draw ten requisitions">
            {TEN_PULL_COST} ◇
          </button>
        </div>
      </header>

      <div className="section-head"><h3>Equipped</h3></div>
      <div className="tile-grid">
        {Array.from({ length: slots }, (_, i) => equipped[i]).map((cardId, i) =>
          cardId ? (
            <CardTile key={cardId} card={findCard(content, cardId)} stars={cards[cardId] ?? 1} owned equipped onClick={() => unequip(cardId)} />
          ) : (
            <div key={`empty-${i}`} className="tile empty sub">Empty slot</div>
          ),
        )}
      </div>

      <div className="section-head">
        <h3>Collection</h3>
        {showNoLanyard && <span className="sub warn">No free lanyard</span>}
      </div>
      <div className="tile-grid">
        {content.cards.map((card) => {
          const owned = card.id in cards;
          return (
            <CardTile
              key={card.id}
              card={card}
              stars={cards[card.id] ?? 0}
              owned={owned}
              equipped={equipped.includes(card.id)}
              onClick={owned ? () => onCollectionClick(card.id) : undefined}
            />
          );
        })}
      </div>

      <div className="card odds">
        <h3>Odds</h3>
        {RARITY_ORDER.map((r) => (
          <div key={r} className="odds-row">
            <span>{RARITY_LABEL[r]}</span>
            <span className="mono">{pct(ODDS[r])}</span>
          </div>
        ))}
        <p className="sub">Senior Staff or better is guaranteed within {PITY_SENIOR} pulls of the last one.</p>
        <p className="sub">Executive is guaranteed within {PITY_EXECUTIVE} pulls of the last one.</p>
      </div>
    </section>
  );
}
