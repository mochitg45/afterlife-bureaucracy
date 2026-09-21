import { useState } from 'react';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { Modal } from '../components/Modal';
import { RESTORE_TEXT } from '../screens/StoreScreen';
import { APP_VERSION, PRIVACY_URL } from '../../version';
import { relativeTime } from '../format';
import type { CloudSyncResult } from '../../engine/cloudSync';

/** What each sync outcome is worth saying out loud after the player asked for it. */
const SYNC_TEXT: Record<CloudSyncResult, string> = {
  none: 'Nothing to sync.',
  uploaded: 'Uploaded this device to the cloud.',
  downloaded: 'Restored this device from the cloud.',
  'kept-local': 'This device already had the newer desk.',
  unavailable: 'Cloud saves are not available here.',
  error: 'Cloud sync failed. Your desk is safe on this device.',
};

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
  const sfx = useGame((s) => s.state.settings.sfx);
  const music = useGame((s) => s.state.settings.music);
  const setSound = useGame((s) => s.setSound);
  const theme = useGame((s) => s.state.settings.theme);
  const setTheme = useGame((s) => s.setTheme);
  const saveVersion = useGame((s) => s.state.saveVersion);
  const fiscalYear = useGame((s) => s.state.fiscalYear);
  const soulsLifetime = useGame((s) => s.state.soulsLifetime);
  const setNotifOptIn = useGame((s) => s.setNotifOptIn);
  const restorePurchases = useGame((s) => s.restorePurchases);
  const cloudAvailable = useGame((s) => s.cloud.available);
  const cloudSignedIn = useGame((s) => s.cloud.signedIn);
  const cloudPlayerName = useGame((s) => s.cloud.playerName);
  const changeAccount = useGame((s) => s.changeAccount);
  const cloudSyncing = useGame((s) => s.cloud.syncing);
  const cloudLastSyncWall = useGame((s) => s.cloud.lastSyncWall);
  const cloudLastResult = useGame((s) => s.cloud.lastResult);
  const signInCloud = useGame((s) => s.signInCloud);
  const syncCloud = useGame((s) => s.syncCloud);
  const uploadLocal = useGame((s) => s.uploadLocal);
  const restoreCloud = useGame((s) => s.restoreCloud);
  const [status, setStatus] = useState('');
  const [confirm, setConfirm] = useState<'upload' | 'restore' | null>(null);

  const onRestore = async () => {
    setStatus(RESTORE_TEXT[await restorePurchases()]);
  };

  const onSignIn = async () => {
    const result = await signInCloud();
    if (result === 'ok') {
      // signInCloud mirrors the sign-in into the achievements client and syncs before it
      // answers, so there is nothing left to do here but say so.
      setStatus('Signed in to Play Games.');
      return;
    }
    setStatus(result === 'cancelled' ? 'Sign-in cancelled.' : 'Play Games is not available on this device.');
  };

  const onSync = async () => {
    setConfirm(null);
    setStatus(SYNC_TEXT[await syncCloud('manual')]);
  };

  /**
   * Both overrides throw one of the two saves away, so each takes a second tap. One confirm
   * is armed at a time: arming the other one disarms the first rather than leaving two
   * loaded buttons next to each other.
   */
  const onOverride = (which: 'upload' | 'restore') => {
    if (confirm !== which) { setConfirm(which); return; }
    setConfirm(null);
    void (async () => {
      setStatus(SYNC_TEXT[await (which === 'upload' ? uploadLocal() : restoreCloud())]);
    })();
  };

  // Every sync action needs an account behind it: without one they can only come back with
  // "Cloud saves are not available here", which is not what is wrong.
  const syncDisabled = !cloudAvailable || !cloudSignedIn || cloudSyncing;

  const cloudStatus = !cloudAvailable
    ? 'Not available on this platform'
    : !cloudSignedIn
      ? 'Not signed in'
      : cloudLastResult === 'error'
        ? 'Sync failed'
        : cloudLastSyncWall > 0
          ? `Synced ${relativeTime(cloudLastSyncWall, Date.now())}`
          : 'Signed in';

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
        <span>Theme</span>
        <div className="mode-switch">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              className={'btn ' + (theme === t ? 'active' : '')}
              onClick={() => setTheme(t)}
            >
              {t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : 'System'}
            </button>
          ))}
        </div>
      </div>
      {/* Labels, not bare rows: the whole row is the hit target, which is the only usable size on a phone. */}
      <label className="settings-row">
        <span>Sound effects</span>
        <input type="checkbox" aria-label="Sound effects" checked={sfx} onChange={(e) => setSound({ sfx: e.target.checked })} />
      </label>
      <label className="settings-row">
        <span>Music</span>
        <input type="checkbox" aria-label="Music" checked={music} onChange={(e) => setSound({ music: e.target.checked })} />
      </label>
      <div className="settings-row">
        <button className="btn btn-ghost" onClick={onGoToOdds}>See requisition odds</button>
      </div>
      <div className="settings-row">
        <button className="btn btn-ghost" onClick={() => void onRestore()}>Restore purchases</button>
      </div>
      <div className="settings-row cloud-row">
        <span>Cloud save</span>
        <span className="sub">{cloudStatus}</span>
      </div>
      <div className="settings-row cloud-actions">
        {cloudAvailable && !cloudSignedIn && (
          <button className="btn btn-ghost" onClick={() => void onSignIn()}>Sign in</button>
        )}
        {cloudAvailable && cloudSignedIn && (
          <button className="btn btn-ghost" onClick={() => void changeAccount()}>Change account</button>
        )}
        <button className="btn btn-ghost" disabled={syncDisabled} onClick={() => void onSync()}>
          Sync now
        </button>
        <button
          className={'btn ' + (confirm === 'upload' ? 'btn-primary' : 'btn-ghost')}
          disabled={syncDisabled}
          onClick={() => onOverride('upload')}
        >
          {confirm === 'upload' ? 'Confirm upload' : 'Upload this device'}
        </button>
        <button
          className={'btn ' + (confirm === 'restore' ? 'btn-primary' : 'btn-ghost')}
          disabled={syncDisabled}
          onClick={() => onOverride('restore')}
        >
          {confirm === 'restore' ? 'Confirm restore' : 'Restore from cloud'}
        </button>
      </div>
      {/* Three buttons that can only answer "not signed in" are three dead ends; the one
          button that does something is the Sign in above, so say so. */}
      {cloudAvailable && !cloudSignedIn && <p className="sub">Sign in to sync.</p>}
      {cloudAvailable && cloudSignedIn && (
        <p className="sub">
          {cloudPlayerName ? `Signed in as ${cloudPlayerName}. ` : ''}
          Change account opens Google Play Games; pick the account there, then come back.
        </p>
      )}
      {confirm && (
        <p className="sub warn">
          {confirm === 'upload'
            ? 'Overwrites the cloud save with this device, whichever run is further along.'
            : 'Overwrites this device with the cloud save, whichever run is further along.'}
        </p>
      )}
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
