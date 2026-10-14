import { useState } from 'react';
import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { PREMIUM_STAFF, ownsPremium, premiumOnDuty, type PremiumStaffDef } from '../../engine/premium';
import type { PurchaseResult } from '../../platform/billing';
import { VoucherIcon } from '../icons/Currency';
import './PremiumPanel.css';

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * One premium hire: portrait, bonus, and either its Buy button (bundle price) or, once owned,
 * the on-duty toggle. `buyOnly` is the Store's version: no duty controls, just the offer.
 */
export function PremiumOffer({ def, buyOnly, onResult }: { def: PremiumStaffDef; buyOnly?: boolean; onResult?: (r: PurchaseResult) => void }) {
  const owned = useGame((s) => ownsPremium(s.state, def.id));
  const onDuty = useGame((s) => premiumOnDuty(s.state)?.id === def.id);
  const product = useGame((s) => s.products.find((p) => p.id === def.product));
  const pending = useGame((s) => s.purchasePending === def.product);
  const buy = useGame((s) => s.buy);
  const setPremium = useGame((s) => s.setPremium);
  return (
    <div className={'card premium-offer' + (onDuty ? ' on-duty' : '')} data-premium={def.id}>
      <span className="premium-ribbon">{t('premium.badge')}</span>
      <img className="premium-art" src={`art/chars/${def.id}.webp`} alt="" />
      <div className="premium-text">
        <h3>{t(`premium.${def.id}.name`)}</h3>
        <p className="sub">{t(`premium.${def.id}.title`)}</p>
        <p className="premium-bonus">{t('premium.bonus', { pct: pct(def.globalMult) })}</p>
        {!owned && <p className="sub amt">{t('premium.bundleIncludes', { vouchers: def.vouchers })} <VoucherIcon size={14} /></p>}
      </div>
      <div className="modal-actions premium-actions">
        {!owned && (
          <button className="btn btn-primary" disabled={!product || pending} onClick={() => void buy(def.product).then((r) => onResult?.(r))}>
            {product ? t('premium.buy', { price: product.price }) : t('premium.unavailable')}
          </button>
        )}
        {owned && buyOnly && <div className="mono value brass">{t('store.owned')}</div>}
        {owned && !buyOnly && (
          <button className={'btn' + (onDuty ? '' : ' btn-primary')} onClick={() => setPremium(onDuty ? null : def.id)}>
            {onDuty ? t('premium.offDuty') : t('premium.onDuty')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Personnel's Premium tab: the one premium slot, then every premium hire on offer. */
export function PremiumPanel() {
  const onDuty = useGame((s) => premiumOnDuty(s.state));
  const [result, setResult] = useState<PurchaseResult | null>(null);
  return (
    <div className="premium-panel">
      <div className="section-head"><h3>{t('premium.slot')}</h3></div>
      <div className="card premium-slot">
        {onDuty
          ? <><img src={`art/chars/${onDuty.id}.webp`} alt="" /><span><strong>{t(`premium.${onDuty.id}.name`)}</strong> · {t('premium.bonus', { pct: pct(onDuty.globalMult) })}</span></>
          : <span className="sub">{t('premium.emptySlot')}</span>}
      </div>
      <p className="sub">{t('premium.explain')}</p>
      {result === 'error' && <p className="sub warn" role="status">{t('store.resultError')}</p>}
      {PREMIUM_STAFF.map((def) => <PremiumOffer key={def.id} def={def} onResult={setResult} />)}
    </div>
  );
}
