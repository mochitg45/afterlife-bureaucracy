import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { relativeTime } from '../format';
import type { CloudNotice as Notice } from '../../store/game';

function line(notice: Notice): string {
  if (notice.kind === 'error') return 'Cloud sync failed. Your desk is safe on this device.';
  // A conflict resolved for the local save ends the same way an empty cloud slot does: this
  // device's desk is now the one in the cloud, so it is one sentence, not two.
  if (notice.kind !== 'downloaded') return 'This device had the newer desk; uploaded it.';
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
  if (!notice) return null;
  return (
    <div className="card cloud-notice" role="status" aria-live="polite">
      <span className="sub">{line(notice)}</span>
      <button className="btn btn-ghost" onClick={dismiss}>Dismiss</button>
    </div>
  );
}
