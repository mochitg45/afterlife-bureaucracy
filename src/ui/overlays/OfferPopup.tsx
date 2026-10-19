import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { nextOffer, markOfferShown, snoozeOffers, type Offer } from '../../engine/offers';
import { track } from '../../platform/analytics';
import { StoreArt } from '../components/StoreArt';
import './OfferPopup.css';

/** Settle time after the office appears, so the offer lands on a calm screen, not over a ceremony. */
const SETTLE_MS = 1200;

/** One pop-up per app open: module state, so a re-render or remount never shows a second one. */
let shownThisOpen = false;
/** Tests reset this between cases. */
export function resetOfferSession(): void { shownThisOpen = false; }

/**
 * The store offer pop-up, shown once each time the app opens (and for a new player right
 * after the tutorial), like most mobile games. Closable in a tap, never a paywall, with a
 * "Don't show again today" box. Which offer is decided by engine/offers.ts.
 */
export function OfferPopup() {
  const ready = useGame((s) => s.ready);
  const busy = useGame((s) => !!(s.pendingPull || s.lastAudit || s.lastCosmic || s.pendingOffline || s.pendingPrize || s.pendingVisitor || s.purchasePending));
  const step = useGame((s) => s.state.onboarding.trainingStep);
  const products = useGame((s) => s.products.length);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [snooze, setSnooze] = useState(false);
  const [posterOk, setPosterOk] = useState(true);
  const product = useGame((s) => (offer ? s.products.find((p) => p.id === offer.product) : undefined));
  const buy = useGame((s) => s.buy);

  useEffect(() => {
    if (shownThisOpen || !ready || busy || step < 3 || !products) return;
    const id = window.setTimeout(() => {
      if (shownThisOpen || document.querySelector('.milestone, .modal-backdrop')) return;
      const g = useGame.getState();
      const o = nextOffer(g.state, Date.now(), g.activeEvent()?.id ?? null);
      // Only offers the store can actually sell right now.
      if (!o || !g.products.some((p) => p.id === o.product)) return;
      shownThisOpen = true;
      useGame.setState({ state: markOfferShown(g.state, o.id) });
      void g.save();
      track('offer_shown', { offer: o.id });
      setPosterOk(true);
      setSnooze(false);
      setOffer(o);
    }, SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [ready, busy, step, products]);

  if (!offer) return null;
  const k = offer.id;
  const close = () => {
    if (snooze) {
      const g = useGame.getState();
      useGame.setState({ state: snoozeOffers(g.state) });
      void g.save();
      track('offer_snoozed', { offer: k });
    }
    setOffer(null);
  };
  return (
    <div className="offer" role="dialog" aria-modal="true" aria-labelledby="offer-title" onClick={close}>
      <div className="offer-card" onClick={(e) => e.stopPropagation()}>
        <span className="offer-tag">{t(k === 'pumpkat' ? 'premium.limited' : 'offer.tag')}</span>
        {posterOk ? (
          <img className="offer-poster" src={`art/offers/${k}.webp`} alt="" onError={() => setPosterOk(false)} />
        ) : (
          <div className="offer-art">
            {k === 'cerberus' || k === 'pumpkat' ? <img src={`art/chars/${k}.webp`} alt="" /> : <StoreArt productId={offer.product} />}
          </div>
        )}
        <h2 id="offer-title" className="offer-title">{t(`offer.${k}.title`)}</h2>
        <p className="offer-pitch">{t(`offer.${k}.pitch`)}</p>
        <button
          className="btn btn-primary offer-buy"
          disabled={!product}
          onClick={() => {
            track('offer_buy_tap', { offer: k });
            void buy(offer.product).then(() => setOffer(null));
          }}
        >
          {product ? t('offer.buy', { price: product.price }) : '…'}
        </button>
        <button className="btn btn-ghost offer-later" onClick={close}>{t('offer.notNow')}</button>
        <label className="offer-snooze">
          <input type="checkbox" checked={snooze} onChange={(e) => setSnooze(e.target.checked)} />
          <span>{t('offer.snooze')}</span>
        </label>
      </div>
    </div>
  );
}
