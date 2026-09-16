import { useState } from 'react';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { Modal } from '../components/Modal';
import { RESTORE_TEXT } from '../screens/StoreScreen';
import { APP_VERSION, PRIVACY_URL } from '../../version';

export function SettingsSheet({
  open,
  onClose,
  onGoToOdds,
  onSaveCode,
}: {
  open: boolean;
  onClose: () => void;
  onGoToOdds: () => void;
  onSaveCode: () => void;
}) {
  const notifOptIn = useGame((s) => s.state.settings.notifOptIn);
  const saveVersion = useGame((s) => s.state.saveVersion);
  const fiscalYear = useGame((s) => s.state.fiscalYear);
  const soulsLifetime = useGame((s) => s.state.soulsLifetime);
  const setNotifOptIn = useGame((s) => s.setNotifOptIn);
  const restorePurchases = useGame((s) => s.restorePurchases);
  const signInGameServices = useGame((s) => s.signInGameServices);
  const [status, setStatus] = useState('');

  const onRestore = async () => {
    setStatus(RESTORE_TEXT[await restorePurchases()]);
  };

  const onSignIn = async () => {
    const ok = await signInGameServices();
    setStatus(ok ? 'Signed in to Play Games.' : 'Play Games could not sign in on this device.');
  };

  return (
    <Modal open={open} title="Settings" onClose={onClose}>
      <p className="sub" role="status" aria-live="polite">{status}</p>
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
      <div className="settings-row">
        <button className="btn btn-ghost" onClick={() => void onRestore()}>Restore purchases</button>
      </div>
      <div className="settings-row">
        <button className="btn btn-ghost" onClick={() => void onSignIn()}>Sign in to Play Games</button>
      </div>
      <div className="settings-row">
        <button className="btn btn-ghost" onClick={onSaveCode}>Export or import a save code</button>
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
