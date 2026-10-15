import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { nextOffer, markOfferShown, type Offer } from '../../engine/offers';
import { track } from '../../platform/analytics';
import { StoreArt } from '../components/StoreArt';
import './OfferPopup.css';

/** Settle time after the screen goes quiet, so an offer never lands on top of a ceremony or milestone. */
const SETTLE_MS = 2500;

const kind = (o: Offer) => (o.id.startsWith('pass:') ? 'pass' : o.id);

/**
 * A soft store offer: one at a good moment, closable in a tap, never a paywall. Which offer
 * and when is decided by engine/offers.ts; this only waits for a quiet screen and shows it.
 */
export function OfferPopup() {
  const ready = useGame((s) => s.ready);
  const busy = useGame((s) => !!(s.pendingPull || s.lastAudit || s.lastCosmic || s.pendingOffline || s.pendingPrize || s.pendingVisitor || s.purchasePending));
  const date = useGame((s) => s.state.dailies.date);
  const audits = useGame((s) => s.state.stats.audits);
  const ads = useGame((s) => s.state.stats.adsWatched);
  const step = useGame((s) => s.state.onboarding.trainingStep);
  const eventKey = useGame((s) => s.state.event?.key);
  const [offer, setOffer] = useState<Offer | null>(null);
  // Painted poster per offer (public/art/offers); falls back to the store icon if it's missing.
  const [posterOk, setPosterOk] = useState(true);
  const product = useGame((s) => (offer ? s.products.find((p) => p.id === offer.product) : undefined));
  const buy = useGame((s) => s.buy);

  useEffect(() => {
    if (!ready || busy || offer) return;
    const id = window.setTimeout(() => {
      const g = useGame.getState();
      const o = nextOffer(g.state, Date.now());
      // No store (web, offline): nothing to sell, and the offer stays unseen for a better day.
      if (!o || !g.products.some((p) => p.id === o.product) || document.querySelector('.milestone, .modal-backdrop')) return;
      useGame.setState({ state: markOfferShown(g.state, o.id) });
      void g.save();
      track('offer_shown', { offer: kind(o) });
      setPosterOk(true);
      setOffer(o);
    }, SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [ready, busy, offer, date, audits, ads, step, eventKey]);

  if (!offer) return null;
  const k = kind(offer);
  const close = () => setOffer(null);
  return (
    <div className="offer" role="dialog" aria-modal="true" aria-labelledby="offer-title" onClick={close}>
      <div className="offer-card" onClick={(e) => e.stopPropagation()}>
        <span className="offer-tag">{t('offer.tag')}</span>
        {posterOk ? (
          <img className="offer-poster" src={`art/offers/${k}.webp`} alt="" onError={() => setPosterOk(false)} />
        ) : (
          <div className="offer-art">
            {k === 'cerberus' ? <img src="art/chars/cerberus.webp" alt="" /> : <StoreArt productId={offer.product} />}
          </div>
        )}
        <h2 id="offer-title" className="offer-title">{t(`offer.${k}.title`)}</h2>
        <p className="offer-pitch">{t(`offer.${k}.pitch`)}</p>
        <button
          className="btn btn-primary offer-buy"
          disabled={!product}
          onClick={() => {
            track('offer_buy_tap', { offer: k });
            void buy(offer.product).then(close);
          }}
        >
          {product ? t('offer.buy', { price: product.price }) : '…'}
        </button>
        <button className="btn btn-ghost offer-later" onClick={close}>{t('offer.notNow')}</button>
      </div>
    </div>
  );
}
