import { useGame, VISITOR_AD_MULT, VISITOR_DEAL_AD_VOUCHERS, VISITOR_DEAL_VOUCHERS } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { Modal } from '../components/Modal';
import { useWatchAd } from '../hooks/useWatchAd';
import { adsSupported } from '../../platform/ads';
import { KarmaIcon, VoucherIcon } from '../icons/Currency';
import { artUrl } from '../characters/art';

/**
 * The letter Pip delivered. Seraphine's blessing pays Karma (×5 with an ad); Gary's deal pays
 * vouchers. Ads are Android only; the free option is always there.
 */
export function VisitorGift() {
  const letter = useGame((s) => s.pendingVisitor);
  const claim = useGame((s) => s.claimVisitor);
  const decline = useGame((s) => s.declineVisitor);
  const canWatch = useGame((s) => s.canWatch('visitor'));
  const { busy, watch } = useWatchAd('visitor');
  if (!letter) return null;
  const angel = letter.from === 'angel';
  const ad = adsSupported() && canWatch;
  const header = (
    <>
      <img className="visitor-sender" src={artUrl(angel ? 'seraphine' : 'gary') ?? ''} alt="" />
      <div className="visitor-tag">{angel ? 'Divine Intervention' : 'Union Business'} · via Pip</div>
    </>
  );
  return (
    <Modal
      open
      title={angel ? 'A Blessing Has Arrived' : 'Gary Has a Deal'}
      header={header}
      className={'visitor-card' + (angel ? '' : ' devil')}
      backdropClassName="visitor-backdrop"
    >
      {angel ? (
        <>
          <p>Heaven's paperwork cleared early. Take the bonus as it is, or watch a short ad to quintuple it.</p>
          <div className="visitor-reward">+{formatNumber(letter.kc)} <KarmaIcon size={20} /></div>
        </>
      ) : (
        <>
          <p>"Found these in a drawer. Totally legit." Requisition Vouchers, no questions asked. Terms and conditions apply, eternally.</p>
          <div className="visitor-reward">+{VISITOR_DEAL_VOUCHERS} <VoucherIcon size={20} /></div>
        </>
      )}
      <div className="modal-actions">
        {ad && (
          <button className="btn btn-primary" disabled={busy} onClick={watch}>
            ▶ Watch ad · {angel ? `×${VISITOR_AD_MULT} (+${formatNumber(letter.kc.mul(VISITOR_AD_MULT))} Karma)` : `+${VISITOR_DEAL_AD_VOUCHERS} vouchers`}
          </button>
        )}
        <button className="btn" disabled={busy} onClick={claim}>
          Take +{angel ? formatNumber(letter.kc) : `${VISITOR_DEAL_VOUCHERS} voucher`}
        </button>
        {!angel && <button className="btn btn-ghost" disabled={busy} onClick={decline}>No deal</button>}
      </div>
    </Modal>
  );
}
