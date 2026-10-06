import { t, tn } from '../../i18n';
import { useState } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { findCard } from '../../engine/content';
import { dupesForNextStar, MAX_STARS, equipSlots, EXCHANGE_COST, EXCHANGE_CHANCE, type ExchangeResult } from '../../engine/gacha';
import { formatNumber } from '../../engine/format';
import { KarmaIcon } from '../icons/Currency';
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
export function bonusLine(card: ReturnType<typeof findCard>, stars: number): string {
  const effect = card.effect;
  const amount = effect.value * stars;
  switch (effect.type) {
    case 'deptMult': {
      const dept = content.departments.find((d) => d.id === effect.dept);
      return t('card.bonus.dept', { pct: pct(amount), dept: dept?.name ?? effect.dept });
    }
    case 'globalMult':
      return t('card.bonus.global', { pct: pct(amount) });
    case 'clickMult':
      return t('card.bonus.click', { pct: pct(amount) });
    case 'offlineCapHours':
      return t('card.bonus.offline', { h: amount });
    case 'voucherMult':
      return t('card.bonus.voucher', { pct: pct(amount) });
    case 'eventMult':
      return t('card.bonus.event', { pct: pct(amount) });
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
    <Modal open title={card.name} label={t('card.label', { name: card.name, title: card.title })} onClose={onClose}>
      <div className="card-sheet-head">
        <Character id={card.character} art={card.id} mood="ok" size={96} />
        <span className="sub">{card.title}</span>
        <span className="sub">{RARITY_LABEL[card.rarity]}</span>
        <Stars stars={stars} className="tile-stars" />
        {stars < MAX_STARS ? (
          <span className="sub">{t('card.dupes', { have: shards, need: dupesForNextStar(card.rarity, stars), next: stars + 1 })}</span>
        ) : (
          <span className="sub">{t('card.maxStars')}</span>
        )}
      </div>
      <p>{card.flavor}</p>
      <p>{t('card.bonusNow', { line: bonusLine(card, stars) })}</p>
      {stars < MAX_STARS && <p>{t('card.nextStar', { line: bonusLine(card, stars + 1) })}</p>}
      {card.event ? <p className="sub brass">{t('card.eventActive')}</p> : <div className="modal-actions">
        <button
          className="btn btn-primary"
          disabled={full}
          onClick={() => {
            if (isEquipped) unequip(cardId); else equip(cardId);
            onClose();
          }}
        >
          {isEquipped ? t('card.unequip') : t('card.equip')}
        </button>
        {full && <span className="sub warn">{t('card.noLanyard')}</span>}
      </div>}
      {canExchange && (
        <div className="modal-actions">
          <button className="btn" onClick={() => setOutcome(exchange(cardId))}>
            {t('card.exchange', { cost: EXCHANGE_COST, chance: pct(EXCHANGE_CHANCE[card.rarity as 'temp' | 'fulltime' | 'senior']) })}
          </button>
          <span className="sub">{tn('card.spares', spares)}</span>
        </div>
      )}
      {outcome && (
        <p className="sub brass">
          {outcome.success
            ? outcome.duplicateKc
              ? t('card.exchanged.maxed', { name: findCard(content, outcome.cardId as string).name, kc: formatNumber(outcome.duplicateKc) })
              : t('card.exchanged.got', { name: findCard(content, outcome.cardId as string).name })
            : t('card.noLuck', { kc: formatNumber(outcome.duplicateKc as NonNullable<typeof outcome.duplicateKc>) })}
          {outcome.duplicateKc && <> <KarmaIcon size={14} /></>}
        </p>
      )}
    </Modal>
  );
}
