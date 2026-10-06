import { t, tn } from '../../i18n';
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
      <div className="visitor-tag">{t('visitor.via', { from: angel ? t('visitor.angelTag') : t('visitor.devilTag') })}</div>
    </>
  );
  return (
    <Modal
      open
      title={angel ? t('visitor.angelTitle') : t('visitor.devilTitle')}
      header={header}
      className={'visitor-card' + (angel ? '' : ' devil')}
      backdropClassName="visitor-backdrop"
    >
      {angel ? (
        <>
          <p>{t('visitor.angelBody')}</p>
          <div className="visitor-reward">+{formatNumber(letter.kc)} <KarmaIcon size={20} /></div>
        </>
      ) : (
        <>
          <p>{t('visitor.devilBody')}</p>
          <div className="visitor-reward">+{VISITOR_DEAL_VOUCHERS} <VoucherIcon size={20} /></div>
        </>
      )}
      <div className="modal-actions">
        {ad && (
          <button className="btn btn-primary" disabled={busy} onClick={watch}>
            {angel ? t('visitor.watchAngel', { mult: VISITOR_AD_MULT, kc: formatNumber(letter.kc.mul(VISITOR_AD_MULT)) }) : t('visitor.watchDevil', { n: VISITOR_DEAL_AD_VOUCHERS })}
          </button>
        )}
        <button className="btn" disabled={busy} onClick={claim}>
          {angel ? t('visitor.takeKc', { kc: formatNumber(letter.kc) }) : tn('visitor.takeVoucher', VISITOR_DEAL_VOUCHERS)}
        </button>
        {!angel && <button className="btn btn-ghost" disabled={busy} onClick={decline}>{t('visitor.decline')}</button>}
      </div>
    </Modal>
  );
}
