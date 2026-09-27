import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { relativeTime } from '../format';
import type { CloudNotice as Notice } from '../../store/game';

function line(notice: Notice): string | null {
  if (notice.kind === 'error') return 'Cloud sync failed. Your desk is safe on this device.';
  // This device would not vouch for its own save, so it was not allowed over the cloud's.
  if (notice.kind === 'refused') return 'Not uploaded: clock check failed.';
  // An upload (plain, or a conflict won by this device) leaves the desk the player is looking
  // at unchanged, so it is not news: no notice.
  if (notice.kind !== 'downloaded') return null;
  const s = notice.summary;
  if (!s) return 'Restored your desk from the cloud.';
  const souls = formatNumber(s.soulsLifetime);
  return `Restored your desk from the cloud · ${souls} souls · FY ${s.fiscalYear} · saved ${relativeTime(s.savedAtWall, Date.now())}`;
}

/**
 * What a sync did, when it did something the player would otherwise discover as a save that
 * changed under them. Silent syncs raise no notice, so this is empty most of the time.
 */
export function CloudNotice() {
  const notice = useGame((s) => s.cloudNotice);
  const dismiss = useGame((s) => s.dismissCloudNotice);
  const text = notice && line(notice);
  if (!text) return null;
  return (
    <div className="card cloud-notice" role="status" aria-live="polite">
      <span className="sub">{text}</span>
      <button className="btn btn-ghost" onClick={dismiss}>Dismiss</button>
    </div>
  );
}
