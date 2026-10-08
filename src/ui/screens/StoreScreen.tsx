import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useGame, type RestoreResult } from '../../store/game';
import { ScreenHeader } from '../components/ScreenHeader';
import { StoreArt } from '../components/StoreArt';
import type { Product, ProductId, PurchaseResult } from '../../platform/billing';
import { t, fmtDate } from '../../i18n';
import { KarmaIcon } from '../icons/Currency';
import {
  STARTER_PACK_VOUCHERS,
  STARTER_PACK_KC_SECONDS,
  UNION_ROLLOVER_VOUCHERS,
  VOUCHER_PACKS,
  starterPackEligible,
  unionActive,
} from '../../engine/entitlements';

/** Google Play requires both statements on any screen that sells a virtual currency. */
export const STORE_FOOTNOTE = t(Capacitor.getPlatform() === 'ios' ? 'store.footnoteIos' : 'store.footnote');

const VOUCHER_PACK_IDS: ProductId[] = ['vouchers_10', 'vouchers_55', 'vouchers_120', 'vouchers_300'];

const RESULT_TEXT: Record<PurchaseResult, string> = {
  ok: t('store.resultOk'),
  cancelled: t('store.resultCancelled'),
  error: t('store.resultError'),
};

/**
 * Three different answers, because "you own nothing on this account" and "the store never
 * replied" send a player somewhere completely different — the first to the purchase they
 * made on another account, the second back to the same button in a minute.
 *
 * Shared with the Settings sheet, which offers the same Restore button.
 */
export const RESTORE_TEXT: Record<RestoreResult, string> = {
  ok: t('store.restoreOk'),
  none: t('store.restoreNone'),
  error: t('store.restoreError'),
};

/**
 * The Starter Pack window closes on a wall-clock deadline, not on anything the player does,
 * so a screen left open would keep offering a lapsed pack. A minute is well inside the
 * three-day window and nowhere near the ten-a-second tick.
 */
const WINDOW_POLL_MS = 60_000;

/** One voucher-pack row. A narrow selector on just this id's flag: a purchase of one pack
 *  must not re-render every other pack's row. */
function PackRow({ product, onResult }: { product: Product; onResult: (r: PurchaseResult) => void }) {
  const firstBuyUsed = useGame((s) => s.state.entitlements.firstBuyUsed[product.id] ?? false);
  const doubleAmount = (VOUCHER_PACKS[product.id] ?? 0) * 2;
  return (
    <div className="card store-section store-row">
      <StoreArt productId={product.id} firstBuy={!firstBuyUsed} />
      <div>
        {!firstBuyUsed && (
          <span style={{ display: 'inline-block', background: 'var(--red)', color: '#F7F2E4', fontSize: '0.7em', fontWeight: 700, letterSpacing: '0.04em', borderRadius: 999, padding: '2px 8px', marginBottom: 4 }}>
            {t('store.firstPurchaseBadge')}
          </span>
        )}
        <BuyButton product={product} onResult={onResult} />
        {!firstBuyUsed && <p className="sub">{t('store.firstPurchaseDouble', { n: doubleAmount })}</p>}
      </div>
    </div>
  );
}

function BuyButton({ product, primary, onResult }: { product: Product; primary?: boolean; onResult: (r: PurchaseResult) => void }) {
  const buy = useGame((s) => s.buy);
  const purchasePending = useGame((s) => s.purchasePending);
  return (
    <button
      className={'btn' + (primary ? ' btn-primary' : '')}
      aria-label={t('store.buy', { title: product.title })}
      disabled={purchasePending !== null}
      onClick={() => void buy(product.id).then(onResult)}
    >
      {product.title} · {product.price}
    </button>
  );
}

export function StoreScreen({ onSettings }: { onSettings?: () => void }) {
  const products = useGame((s) => s.products);
  const entitlements = useGame((s) => s.state.entitlements);
  const firstSeenWallClock = useGame((s) => s.state.firstSeenWallClock);
  const purchasePending = useGame((s) => s.purchasePending);
  const restorePurchases = useGame((s) => s.restorePurchases);
  // One result line for the whole screen, so a purchase started in any section is reported
  // in the same place.
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [restore, setRestore] = useState<RestoreResult | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), WINDOW_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const byId = new Map(products.map((p) => [p.id, p]));
  const packs = VOUCHER_PACK_IDS.flatMap((id) => {
    const p = byId.get(id);
    return p ? [p] : [];
  });
  const removeAds = byId.get('remove_ads');
  const starterPack = byId.get('starter_pack');
  const union = byId.get('union_monthly');
  const unionOn = unionActive({ entitlements }, now);
  const starterOn = starterPackEligible({ entitlements, firstSeenWallClock }, now);
  // A purchase in flight outranks both; otherwise whichever of the two the player asked for
  // most recently is the one being reported, and `onRestore`/`setResult` clear the other.
  const status = purchasePending ? t('store.pending') : result ? RESULT_TEXT[result] : restore ? RESTORE_TEXT[restore] : '';

  const onPurchase = (r: PurchaseResult) => {
    setRestore(null);
    setResult(r);
  };

  return (
    <section className="screen store">
      <ScreenHeader title={t('store.title')} onSettings={onSettings} />
      <p className="sub" role="status" aria-live="polite">{status}</p>

      {products.length === 0 && (
        <div className="card"><p className="sub">{t('store.closed')}</p></div>
      )}

      {packs.length > 0 && (
        <>
          <h3>{t('store.vouchers')}</h3>
          <p className="sub">{t('store.vouchersDesc')}</p>
          {packs.map((p) => <PackRow product={p} onResult={onPurchase} key={p.id} />)}
        </>
      )}

      {removeAds && (
        <div className="card store-section">
          <div className="store-row">
            <StoreArt productId="remove_ads" />
            <div>
              <h3>{t('store.removeAds')}</h3>
              <p className="sub">{t('store.removeAdsDesc')}</p>
            </div>
          </div>
          {entitlements.removeAds
            ? <div className="mono value brass">{t('store.owned')}</div>
            : <div className="modal-actions"><BuyButton product={removeAds} onResult={onPurchase} /></div>}
        </div>
      )}

      {starterPack && starterOn && (
        <div className="card store-section">
          <div className="store-row">
            <StoreArt productId="starter_pack" />
            <div>
              <h3>{t('store.starterPack')}</h3>
              <p className="sub">
                {t('store.starterPackDesc', { vouchers: STARTER_PACK_VOUCHERS, minutes: STARTER_PACK_KC_SECONDS / 60 })} <KarmaIcon size={14} />
              </p>
            </div>
          </div>
          <div className="modal-actions"><BuyButton product={starterPack} primary onResult={onPurchase} /></div>
        </div>
      )}

      {union && (
        <div className="card store-section">
          <div className="store-row">
            <StoreArt productId="union_monthly" />
            <div>
              <h3>{t('store.union')}</h3>
              <p className="sub">{t('store.unionDesc', { vouchers: UNION_ROLLOVER_VOUCHERS })}</p>
            </div>
          </div>
          {unionOn && <div className="mono brass">{t('store.unionActive', { date: fmtDate(entitlements.unionUntilWall, {}) })}</div>}
          <div className="modal-actions"><BuyButton product={union} primary={!unionOn} onResult={onPurchase} /></div>
        </div>
      )}

      <div className="modal-actions">
        <button
          className="btn btn-ghost"
          onClick={() => void restorePurchases().then((r) => { setResult(null); setRestore(r); })}
        >
          {t('store.restore')}
        </button>
      </div>
      <p className="sub store-footnote">{STORE_FOOTNOTE}</p>
    </section>
  );
}
