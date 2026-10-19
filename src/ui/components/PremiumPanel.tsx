import { useState } from 'react';
import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { PREMIUM_STAFF, ownsPremium, onDutyIn, onSale, type PremiumSlot, type PremiumStaffDef } from '../../engine/premium';
import type { PurchaseResult } from '../../platform/billing';
import { VoucherIcon } from '../icons/Currency';
import './PremiumPanel.css';

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** The bonus line(s) a premium hire gives: +X% souls, and x2 event currency for pets. */
function Bonus({ def }: { def: PremiumStaffDef }) {
  return (
    <>
      <p className="premium-bonus">{t('premium.bonus', { pct: pct(def.globalMult) })}</p>
      {def.eventMult && def.eventMult > 1 && <p className="premium-bonus">{t('premium.eventBonus', { mult: def.eventMult })}</p>}
    </>
  );
}

/** The id of the event running now, so a limited (event-only) item knows if it's on sale. */
export const useRunningEventId = () => useGame((s) => s.activeEvent()?.id ?? null);

/**
 * One premium hire: portrait, bonus, and either its Buy button (bundle price) or, once owned,
 * the on-duty toggle. `buyOnly` is the Store's version: no duty controls, just the offer.
 */
export function PremiumOffer({ def, buyOnly, onResult }: { def: PremiumStaffDef; buyOnly?: boolean; onResult?: (r: PurchaseResult) => void }) {
  const owned = useGame((s) => ownsPremium(s.state, def.id));
  const onDuty = useGame((s) => onDutyIn(s.state, def.slot)?.id === def.id);
  const product = useGame((s) => s.products.find((p) => p.id === def.product));
  const pending = useGame((s) => s.purchasePending === def.product);
  const buy = useGame((s) => s.buy);
  const setPremium = useGame((s) => s.setPremium);
  return (
    <div className={'card premium-offer' + (onDuty ? ' on-duty' : '')} data-premium={def.id}>
      <span className="premium-ribbon">{def.saleEvent ? t('premium.limited') : t('premium.badge')}</span>
      <img className="premium-art" src={`art/chars/${def.id}.webp`} alt="" />
      <div className="premium-text">
        <h3>{t(`premium.${def.id}.name`)}</h3>
        <p className="sub">{t(`premium.${def.id}.title`)}</p>
        <Bonus def={def} />
        {!owned && def.vouchers > 0 && <p className="sub amt">{t('premium.bundleIncludes', { vouchers: def.vouchers })} <VoucherIcon size={14} /></p>}
        {!owned && def.saleEvent && <p className="sub">{t('premium.limitedNote')}</p>}
      </div>
      <div className="modal-actions premium-actions">
        {!owned && (
          <button className="btn btn-primary" disabled={!product || pending} onClick={() => void buy(def.product).then((r) => onResult?.(r))}>
            {product ? t('premium.buy', { price: product.price }) : t('premium.unavailable')}
          </button>
        )}
        {owned && buyOnly && <div className="mono value brass">{t('store.owned')}</div>}
        {owned && !buyOnly && (
          <button className={'btn' + (onDuty ? '' : ' btn-primary')} onClick={() => setPremium(onDuty ? null : def.id, def.slot)}>
            {onDuty ? t('premium.offDuty') : t('premium.onDuty')}
          </button>
        )}
      </div>
    </div>
  );
}

function SlotCard({ slot }: { slot: PremiumSlot }) {
  const onDuty = useGame((s) => onDutyIn(s.state, slot));
  return (
    <>
      <div className="section-head"><h3>{t(slot === 'pet' ? 'premium.petSlot' : 'premium.slot')}</h3></div>
      <div className="card premium-slot">
        {onDuty
          ? <><img src={`art/chars/${onDuty.id}.webp`} alt="" /><span><strong>{t(`premium.${onDuty.id}.name`)}</strong> · {t('premium.bonus', { pct: pct(onDuty.globalMult) })}</span></>
          : <span className="sub">{t(slot === 'pet' ? 'premium.petEmpty' : 'premium.emptySlot')}</span>}
      </div>
    </>
  );
}

/** Personnel's Premium tab: the premium slot and the pet slot, then every hire on offer or owned. */
export function PremiumPanel() {
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const eventId = useRunningEventId();
  const owned = useGame((s) => s.state.entitlements.premium ?? []);
  const shown = PREMIUM_STAFF.filter((def) => owned.includes(def.id) || onSale(def, eventId));
  return (
    <div className="premium-panel">
      <SlotCard slot="premium" />
      <SlotCard slot="pet" />
      <p className="sub">{t('premium.explain')}</p>
      {result === 'error' && <p className="sub warn" role="status">{t('store.resultError')}</p>}
      {shown.map((def) => <PremiumOffer key={def.id} def={def} onResult={setResult} />)}
    </div>
  );
}
