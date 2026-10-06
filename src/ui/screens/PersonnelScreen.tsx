import { memo, useCallback, useRef, useState } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { findCard } from '../../engine/content';
import type { Rarity } from '../../engine/content';
import { PITY_SENIOR, PITY_EXECUTIVE, PULL_COST, TEN_PULL_COST, ODDS, EXCHANGE_COST, EXCHANGE_CHANCE, equipSlots } from '../../engine/gacha';
import { CardTile, RARITY_LABEL } from '../components/CardTile';
import { ScreenHeader } from '../components/ScreenHeader';
import { AdButton } from '../components/AdButton';
import { CardSheet } from '../overlays/CardSheet';
import { VoucherIcon } from '../icons/Currency';
import { t } from '../../i18n';

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
    <div className="tile-grid" data-coach="collection">
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
      <ScreenHeader title={t('personnel.title')} onSettings={onSettings} />
      <header className="card">
        <div className="label">{t('personnel.vouchers')}</div>
        <div className="mono value brass amt" role="img" aria-label={t('personnel.vouchersAria', { n: vouchers })}>
          {vouchers} <VoucherIcon size={22} />
        </div>
        <p className="sub">{t('personnel.seniorIn', { n: PITY_SENIOR - pity.senior })}</p>
        <p className="sub">{t('personnel.execIn', { n: PITY_EXECUTIVE - pity.executive })}</p>
        <div className="modal-actions" data-coach="pull">
          <button className="btn" disabled={vouchers < PULL_COST} onClick={() => pull(1)} aria-label={t('personnel.drawOne', { cost: PULL_COST })}>
            <span className="amt">{PULL_COST} <VoucherIcon /></span>
          </button>
          <button className="btn btn-primary" disabled={vouchers < TEN_PULL_COST} onClick={() => pull(10)} aria-label={t('personnel.drawTen', { cost: TEN_PULL_COST })}>
            <span className="amt">{TEN_PULL_COST} <VoucherIcon /></span>
          </button>
          <AdButton placement="free-pull" label={t('personnel.freePull')} />
          <button
            className="btn btn-ghost"
            aria-label={t('personnel.seeOdds')}
            onClick={() => oddsRef.current?.scrollIntoView?.({ behavior: 'smooth' })}
          >
            {t('personnel.seeOdds')}
          </button>
        </div>
      </header>

      <div className="section-head"><h3>{t('personnel.equipped')}</h3></div>
      <div className="tile-grid" data-coach="equipped">
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
            <div key={`empty-${i}`} className="tile empty sub">{t('personnel.emptySlot')}</div>
          ),
        )}
      </div>

      <div className="section-head">
        <h3>{t('personnel.collection')}</h3>
      </div>
      <Collection cards={cards} cardShards={cardShards} equipped={equipped} onCardClick={onCollectionClick} />
      {sheetCardId && <CardSheet cardId={sheetCardId} onClose={() => setSheetCardId(null)} />}

      <div className="card odds" ref={oddsRef}>
        <h3>{t('personnel.odds')}</h3>
        {RARITY_ORDER.map((r) => (
          <div key={r} className="odds-row">
            <span>{RARITY_LABEL[r]}</span>
            <span className="mono">{pct(ODDS[r])}</span>
          </div>
        ))}
        <p className="sub">{t('personnel.pitySenior', { n: PITY_SENIOR })}</p>
        <p className="sub">{t('personnel.pityExec', { n: PITY_EXECUTIVE })}</p>
        <h3>{t('personnel.exchange')}</h3>
        <p className="sub">{t('personnel.exchangeDesc', { n: EXCHANGE_COST })}</p>
        {(['temp', 'fulltime', 'senior'] as const).map((r) => (
          <div key={r} className="odds-row">
            <span>{t('personnel.exchangeRow', { from: RARITY_LABEL[r], to: RARITY_LABEL[RARITY_ORDER[RARITY_ORDER.indexOf(r) + 1]] })}</span>
            <span className="mono">{pct(EXCHANGE_CHANCE[r])}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
