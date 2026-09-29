import { useGame, VISITOR_AD_MULT } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { Modal } from '../components/Modal';
import { useWatchAd } from '../hooks/useWatchAd';
import { adsSupported } from '../../platform/ads';
import { KarmaIcon } from '../icons/Currency';
import { pipFrameUrl } from '../components/Visitor';

/** Pip's delivery: take the Karma, or (Android) watch an ad for ×VISITOR_AD_MULT. */
export function VisitorGift() {
  const gift = useGame((s) => s.pendingVisitor);
  const claim = useGame((s) => s.claimVisitor);
  const canWatch = useGame((s) => s.canWatch('visitor'));
  const { busy, watch } = useWatchAd('visitor');
  if (!gift) return null;
  const big = gift.kc.mul(VISITOR_AD_MULT);
  return (
    <Modal open title="Special Delivery" header={<img className="visitor-gift-pip" src={pipFrameUrl(2)} alt="" />}>
      <p className="sub">Pip brought a blessing from upstairs, already stamped and approved.</p>
      <div className="visitor-gift-amt mono value brass amt">+{formatNumber(gift.kc)} <KarmaIcon size={22} /></div>
      <div className="modal-actions">
        {adsSupported() && canWatch && (
          <button className="btn btn-primary" aria-label={`Watch ad ×${VISITOR_AD_MULT}`} disabled={busy} onClick={watch}>
            Watch ad ×{VISITOR_AD_MULT} (+{formatNumber(big)})
          </button>
        )}
        <button className="btn btn-ghost" disabled={busy} onClick={claim}>Take +{formatNumber(gift.kc)}</button>
      </div>
    </Modal>
  );
}
