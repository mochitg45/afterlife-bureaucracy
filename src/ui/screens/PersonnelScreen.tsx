import { memo, useCallback, useRef, useState } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { findCard } from '../../engine/content';
import type { Rarity } from '../../engine/content';
import { PITY_SENIOR, PITY_EXECUTIVE, PULL_COST, TEN_PULL_COST, ODDS, equipSlots } from '../../engine/gacha';
import { CardTile, RARITY_LABEL } from '../components/CardTile';
import { ScreenHeader } from '../components/ScreenHeader';
import { AdButton } from '../components/AdButton';
import { CardSheet } from '../overlays/CardSheet';

const RARITY_ORDER: Rarity[] = ['temp', 'fulltime', 'senior', 'executive'];

/** ODDS is a fraction (0.245); the odds card needs "24.5%" without float noise (0.245 * 100 !== 24.5 exactly). */
function pct(value: number): string {
  const tenths = Math.round(value * 1000) / 10;
  return (Number.isInteger(tenths) ? tenths.toString() : tenths.toFixed(1)) + '%';
}

/**
 * Every shipped card, which changes only when one is drawn, equipped or unequipped. Memoised
 * so the grid is not rebuilt by the tick loop behind it.
 */
const Collection = memo(function Collection({
  cards,
  cardShards,
  equipped,
  onCardClick,
}: {
  cards: Record<string, number>;
  cardShards: Record<string, number>;
  equipped: string[];
  onCardClick: (cardId: string) => void;
}) {
  return (
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
            onClick={owned ? () => onCardClick(card.id) : undefined}
            shards={cardShards[card.id] ?? 0}
          />
        );
      })}
    </div>
  );
});

export function PersonnelScreen({ onSettings }: { onSettings?: () => void }) {
  // Narrow subscriptions rather than the whole GameState: kc and souls move on every tick and
  // nothing on this screen reads them.
  const vouchers = useGame((s) => s.state.vouchers);
  const pity = useGame((s) => s.state.pity);
  const cards = useGame((s) => s.state.cards);
  const cardShards = useGame((s) => s.state.cardShards);
  const equipped = useGame((s) => s.state.equipped);
  const perks = useGame((s) => s.state.perks);
  const pull = useGame((s) => s.pull);
  const unequip = useGame((s) => s.unequip);
  const [sheetCardId, setSheetCardId] = useState<string | null>(null);
  const oddsRef = useRef<HTMLDivElement>(null);

  const slots = equipSlots({ perks }, content);

  // Stable across ticks so the memoised Collection below is not invalidated by a new closure.
  const onCollectionClick = useCallback((cardId: string) => setSheetCardId(cardId), []);

  return (
    <section className="screen personnel">
      <ScreenHeader title="Personnel" onSettings={onSettings} />
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
          <AdButton placement="free-pull" label="Free daily pull" />
          <button
            className="btn btn-ghost"
            aria-label="See odds"
            onClick={() => oddsRef.current?.scrollIntoView?.({ behavior: 'smooth' })}
          >
            See odds
          </button>
        </div>
      </header>

      <div className="section-head"><h3>Equipped</h3></div>
      <div className="tile-grid">
        {Array.from({ length: slots }, (_, i) => equipped[i]).map((cardId, i) =>
          cardId ? (
            <CardTile
              key={cardId}
              card={findCard(content, cardId)}
              stars={cards[cardId] ?? 1}
              owned
              equipped
              onClick={() => unequip(cardId)}
              shards={cardShards[cardId] ?? 0}
            />
          ) : (
            <div key={`empty-${i}`} className="tile empty sub">Empty slot</div>
          ),
        )}
      </div>

      <div className="section-head">
        <h3>Collection</h3>
      </div>
      <Collection cards={cards} cardShards={cardShards} equipped={equipped} onCardClick={onCollectionClick} />
      {sheetCardId && <CardSheet cardId={sheetCardId} onClose={() => setSheetCardId(null)} />}

      <div className="card odds" ref={oddsRef}>
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
