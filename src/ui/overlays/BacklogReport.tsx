import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { Modal } from '../components/Modal';

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

export function BacklogReport() {
  const pending = useGame((s) => s.pendingOffline);
  const dismiss = useGame((s) => s.dismissOffline);
  const canWatch = useGame((s) => s.canWatch('offline-double'));
  const watchAd = useGame((s) => s.watchAd);
  if (!pending) return null;
  return (
    <Modal open title="Overnight Backlog Report">
      <p className="sub">Staff kept stamping for {fmtDuration(pending.creditedSec)} while you were away.</p>
      {pending.capped && <p className="sub warn">Backlog full: the in-tray overflowed at the offline cap. Extend it with Night Shift Rota.</p>}
      <div className="report-grid">
        <div><div className="label">Souls</div><div className="mono value">{formatNumber(pending.souls)}</div></div>
        <div><div className="label">Karma Credits</div><div className="mono value brass">{formatNumber(pending.kc)}</div></div>
      </div>
      <div className="modal-actions">
        {/* Hidden, not disabled: there is no reward to promise when the placement is closed. */}
        {canWatch && (
          <button className="btn btn-primary" aria-label="Watch ad ×2" onClick={() => void watchAd('offline-double')}>
            Watch ad ×2
          </button>
        )}
        <button className="btn btn-ghost" onClick={dismiss}>File it</button>
      </div>
    </Modal>
  );
}
