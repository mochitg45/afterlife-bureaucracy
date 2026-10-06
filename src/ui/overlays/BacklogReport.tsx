import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { Modal } from '../components/Modal';
import { useWatchAd } from '../hooks/useWatchAd';
import { adsSupported } from '../../platform/ads';
import { KarmaIcon } from '../icons/Currency';

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return t('backlog.duration', { h, m });
}

export function BacklogReport() {
  const pending = useGame((s) => s.pendingOffline);
  const dismiss = useGame((s) => s.dismissOffline);
  const canWatch = useGame((s) => s.canWatch('offline-double'));
  const { busy, watch } = useWatchAd('offline-double');
  if (!pending) return null;
  return (
    <Modal open title={t('backlog.title')}>
      <p className="sub">{t('backlog.away', { duration: fmtDuration(pending.creditedSec) })}</p>
      {pending.capped && <p className="sub warn">{t('backlog.capped')}</p>}
      <div className="report-grid">
        <div><div className="label">{t('backlog.souls')}</div><div className="mono value">{formatNumber(pending.souls)}</div></div>
        <div><div className="label">{t('backlog.kc')}</div><div className="mono value brass amt">{formatNumber(pending.kc)} <KarmaIcon size={20} /></div></div>
      </div>
      <div className="modal-actions">
        {/* Hidden, not disabled: there is no reward to promise when the placement is closed,
            and no ad network at all on iOS. */}
        {adsSupported() && canWatch && (
          <button className="btn btn-primary" aria-label={t('backlog.watch')} disabled={busy} onClick={watch}>
            {t('backlog.watch')}
          </button>
        )}
        <button className="btn btn-ghost" onClick={dismiss}>{t('backlog.file')}</button>
      </div>
    </Modal>
  );
}
