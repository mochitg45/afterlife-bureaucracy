import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { Modal } from '../components/Modal';

/** Asks to opt in to reminders once the player has stuck around two days, and only when nothing else is on screen. */
export function NotifPrompt() {
  const shouldAsk = useGame((s) => s.shouldAskNotifications());
  const pendingOffline = useGame((s) => s.pendingOffline);
  const pendingPull = useGame((s) => s.pendingPull);
  const lastAudit = useGame((s) => s.lastAudit);
  const setNotifOptIn = useGame((s) => s.setNotifOptIn);

  const visible = shouldAsk && !pendingOffline && !pendingPull && !lastAudit;
  if (!visible) return null;

  return (
    <Modal open title={t('notif.title')}>
      <p>{t('notif.body')}</p>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={() => void setNotifOptIn('yes')}>{t('notif.yes')}</button>
        <button className="btn btn-ghost" onClick={() => void setNotifOptIn('no')}>{t('notif.no')}</button>
      </div>
    </Modal>
  );
}
