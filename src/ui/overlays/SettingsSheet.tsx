import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { Modal } from '../components/Modal';
import { APP_VERSION, PRIVACY_URL } from '../../version';

export function SettingsSheet({ open, onClose, onGoToOdds }: { open: boolean; onClose: () => void; onGoToOdds: () => void }) {
  const notifOptIn = useGame((s) => s.state.settings.notifOptIn);
  const saveVersion = useGame((s) => s.state.saveVersion);
  const fiscalYear = useGame((s) => s.state.fiscalYear);
  const soulsLifetime = useGame((s) => s.state.soulsLifetime);
  const setNotifOptIn = useGame((s) => s.setNotifOptIn);

  return (
    <Modal open={open} title="Settings" onClose={onClose}>
      <div className="settings-row">
        <label htmlFor="notif-optin">Notifications</label>
        <input
          id="notif-optin"
          type="checkbox"
          aria-label="Reminder notifications"
          checked={notifOptIn === 'yes'}
          onChange={(e) => void setNotifOptIn(e.target.checked ? 'yes' : 'no')}
        />
      </div>
      <div className="settings-row">
        <button className="btn btn-ghost" onClick={onGoToOdds}>See requisition odds</button>
      </div>
      <div className="settings-row mono sub">
        Save v{saveVersion} · FY {fiscalYear} · {formatNumber(soulsLifetime)} souls lifetime
      </div>
      <div className="settings-row mono sub">{APP_VERSION}</div>
      <div className="settings-row">
        <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a>
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
