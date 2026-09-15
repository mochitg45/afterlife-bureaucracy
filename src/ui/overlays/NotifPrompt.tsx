import { useGame } from '../../store/game';
import { Modal } from '../components/Modal';

/** Asks to opt in to reminders once the player has stuck around two days, and only when nothing else is on screen. */
export function NotifPrompt() {
  const shouldAsk = useGame((s) => s.shouldAskNotifications());
  const pendingOffline = useGame((s) => s.pendingOffline);
  const pendingPull = useGame((s) => s.pendingPull);
  const pendingStory = useGame((s) => s.pendingStory[0]);
  const lastAudit = useGame((s) => s.lastAudit);
  const setNotifOptIn = useGame((s) => s.setNotifOptIn);

  const visible = shouldAsk && !pendingOffline && !pendingPull && !pendingStory && !lastAudit;
  if (!visible) return null;

  return (
    <Modal open title="Reminders">
      <p>Get a nudge when the in-tray fills up or fresh tasks land?</p>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={() => void setNotifOptIn('yes')}>Yes, remind me</button>
        <button className="btn btn-ghost" onClick={() => void setNotifOptIn('no')}>Not now</button>
      </div>
    </Modal>
  );
}
