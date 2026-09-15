import { useState } from 'react';
import { useGame } from '../../store/game';
import { ScreenHeader } from '../components/ScreenHeader';
import type { Product, ProductId, PurchaseResult } from '../../platform/billing';
import {
  STARTER_PACK_VOUCHERS,
  STARTER_PACK_KC_SECONDS,
  UNION_ROLLOVER_VOUCHERS,
  starterPackEligible,
  unionActive,
} from '../../engine/entitlements';

/** Google Play requires both statements on any screen that sells a virtual currency. */
export const STORE_FOOTNOTE =
  'Requisition Vouchers are a virtual currency with no real-world value. Subscriptions renew monthly until cancelled in Google Play.';

const VOUCHER_PACK_IDS: ProductId[] = ['vouchers_10', 'vouchers_55', 'vouchers_120', 'vouchers_300'];

const RESULT_TEXT: Record<PurchaseResult, string> = {
  ok: 'Purchase filed. Thank you for your custom.',
  cancelled: 'Purchase cancelled. Nothing was charged.',
  error: 'The requisition desk could not complete that. Nothing was charged.',
};

function BuyButton({ product, primary, onResult }: { product: Product; primary?: boolean; onResult: (r: PurchaseResult) => void }) {
  const buy = useGame((s) => s.buy);
  const purchasePending = useGame((s) => s.purchasePending);
  return (
    <button
      className={'btn' + (primary ? ' btn-primary' : '')}
      aria-label={`Buy ${product.title}`}
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

  const now = Date.now();
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
  const status = purchasePending ? 'Purchase pending…' : result ? RESULT_TEXT[result] : '';

  return (
    <section className="screen store">
      <ScreenHeader title="Store" onSettings={onSettings} />
      <p className="sub" role="status" aria-live="polite">{status}</p>

      {products.length === 0 && (
        <div className="card"><p className="sub">The requisition desk is closed. Try again once the office is back online.</p></div>
      )}

      {packs.length > 0 && (
        <div className="card store-section">
          <h3>Vouchers</h3>
          <p className="sub">Spend them on requisitions in Personnel. Purchased vouchers are never multiplied.</p>
          <div className="modal-actions">
            {packs.map((p) => <BuyButton key={p.id} product={p} onResult={setResult} />)}
          </div>
        </div>
      )}

      {removeAds && (
        <div className="card store-section">
          <h3>Remove Ads</h3>
          <p className="sub">Hides every ad prompt and doubles the Overnight Backlog Report, permanently. The rewarded buttons stay available.</p>
          {entitlements.removeAds
            ? <div className="mono value brass">Owned</div>
            : <div className="modal-actions"><BuyButton product={removeAds} onResult={setResult} /></div>}
        </div>
      )}

      {starterPack && starterOn && (
        <div className="card store-section">
          <h3>Starter Pack</h3>
          <p className="sub">
            {STARTER_PACK_VOUCHERS} Requisition Vouchers, Grandma Liu at one star, and Karma Credits worth{' '}
            {STARTER_PACK_KC_SECONDS / 60} minutes of your current income. Offered once, in your first three days.
          </p>
          <div className="modal-actions"><BuyButton product={starterPack} primary onResult={setResult} /></div>
        </div>
      )}

      {union && (
        <div className="card store-section">
          <h3>Union Membership</h3>
          <p className="sub">
            +25% to everything the office earns, {UNION_ROLLOVER_VOUCHERS} vouchers on every daily rollover, and finished
            daily tasks file themselves.
          </p>
          {unionOn && <div className="mono brass">Active until {new Date(entitlements.unionUntilWall).toLocaleDateString()}</div>}
          <div className="modal-actions"><BuyButton product={union} primary={!unionOn} onResult={setResult} /></div>
        </div>
      )}

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={() => void restorePurchases()}>Restore purchases</button>
      </div>
      <p className="sub store-footnote">{STORE_FOOTNOTE}</p>
    </section>
  );
}
