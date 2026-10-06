import { useState } from 'react';
import { t } from '../../i18n';
import { LanguagePicker } from '../components/LanguagePicker';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { Modal } from '../components/Modal';
import { RESTORE_TEXT } from '../screens/StoreScreen';
import { APP_VERSION, PRIVACY_URL } from '../../version';
import { relativeTime } from '../format';
import type { CloudSyncResult } from '../../engine/cloudSync';

/** What each sync outcome is worth saying out loud after the player asked for it. */
const SYNC_TEXT: Record<CloudSyncResult, string> = {
  none: t('settings.sync.none'),
  uploaded: t('settings.sync.uploaded'),
  downloaded: t('settings.sync.downloaded'),
  'kept-local': t('settings.sync.keptLocal'),
  unavailable: t('settings.sync.unavailable'),
  error: t('settings.sync.error'),
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
  const replayTips = useGame((s) => s.replayTips);
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
      setStatus(t('settings.signedIn'));
      return;
    }
    setStatus(result === 'cancelled' ? t('settings.signInCancelled') : t('settings.playGamesUnavailable'));
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
    ? t('settings.cloud.unavailable')
    : !cloudSignedIn
      ? t('settings.cloud.signedOut')
      : cloudLastResult === 'error'
        ? t('settings.cloud.failed')
        : cloudLastSyncWall > 0
          ? t('settings.cloud.synced', { when: relativeTime(cloudLastSyncWall, Date.now()) })
          : t('settings.cloud.signedIn');

  return (
    <Modal open={open} title={t('settings.title')} onClose={onClose}>
      <p className="sub" role="status" aria-live="polite">{status}</p>
      <div className="settings-row">
        <label htmlFor="notif-optin">{t('settings.notifications')}</label>
        <input
          id="notif-optin"
          type="checkbox"
          aria-label={t('settings.notificationsAria')}
          checked={notifOptIn === 'yes'}
          onChange={(e) => void setNotifOptIn(e.target.checked ? 'yes' : 'no')}
        />
      </div>
      {/* Labels, not bare rows: the whole row is the hit target, which is the only usable size on a phone. */}
      <label className="settings-row">
        <span>{t('settings.sfx')}</span>
        <input type="checkbox" aria-label={t('settings.sfx')} checked={sfx} onChange={(e) => setSound({ sfx: e.target.checked })} />
      </label>
      <label className="settings-row">
        <span>{t('settings.music')}</span>
        <input type="checkbox" aria-label={t('settings.music')} checked={music} onChange={(e) => setSound({ music: e.target.checked })} />
      </label>
      <label className="settings-row">
        <span>{t('settings.language')}</span>
        {/* Each language in its own name, so a wrong pick can still be undone. Switching reloads. */}
        <LanguagePicker />
      </label>
      <div className="settings-row">
        <button className="btn btn-ghost" onClick={onGoToOdds}>{t('settings.odds')}</button>
      </div>
      <div className="settings-row">
        {/* Closes the sheet so the walkthrough it restarts is not hiding behind it. */}
        <button className="btn btn-ghost" onClick={() => { replayTips(); onClose(); }}>{t('settings.replayTips')}</button>
      </div>
      <div className="settings-row">
        <button className="btn btn-ghost" onClick={() => void onRestore()}>{t('settings.restorePurchases')}</button>
      </div>
      <div className="settings-row cloud-row">
        <span>{t('settings.cloudSave')}</span>
        <span className="sub">{cloudStatus}</span>
      </div>
      <div className="settings-row cloud-actions">
        {cloudAvailable && !cloudSignedIn && (
          <button className="btn btn-ghost" onClick={() => void onSignIn()}>{t('settings.signIn')}</button>
        )}
        {cloudAvailable && cloudSignedIn && (
          <button className="btn btn-ghost" onClick={() => void changeAccount()}>{t('settings.changeAccount')}</button>
        )}
        <button className="btn btn-ghost" disabled={syncDisabled} onClick={() => void onSync()}>
          {t('settings.syncNow')}
        </button>
        <button
          className={'btn ' + (confirm === 'upload' ? 'btn-primary' : 'btn-ghost')}
          disabled={syncDisabled}
          onClick={() => onOverride('upload')}
        >
          {confirm === 'upload' ? t('settings.confirmUpload') : t('settings.upload')}
        </button>
        <button
          className={'btn ' + (confirm === 'restore' ? 'btn-primary' : 'btn-ghost')}
          disabled={syncDisabled}
          onClick={() => onOverride('restore')}
        >
          {confirm === 'restore' ? t('settings.confirmRestore') : t('settings.restoreCloud')}
        </button>
      </div>
      {/* Three buttons that can only answer "not signed in" are three dead ends; the one
          button that does something is the Sign in above, so say so. */}
      {cloudAvailable && !cloudSignedIn && <p className="sub">{t('settings.signInToSync')}</p>}
      {cloudAvailable && cloudSignedIn && (
        <p className="sub">
          {cloudPlayerName ? t('settings.signedInAs', { name: cloudPlayerName }) + ' ' : ''}
          {t('settings.changeAccountHelp')}
        </p>
      )}
      {confirm && (
        <p className="sub warn">
          {confirm === 'upload'
            ? t('settings.warnUpload')
            : t('settings.warnRestore')}
        </p>
      )}
      <div className="settings-row">
        <button className="btn btn-ghost" onClick={onSaveCode}>{t('settings.saveCode')}</button>
      </div>
      <div className="settings-row mono sub">
        {t('settings.stats', { v: saveVersion, fy: fiscalYear, souls: formatNumber(soulsLifetime) })}
      </div>
      <div className="settings-row mono sub">{APP_VERSION}</div>
      <div className="settings-row">
        <a href={PRIVACY_URL} target="_blank" rel="noreferrer">{t('settings.privacy')}</a>
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>{t('settings.close')}</button>
      </div>
    </Modal>
  );
}
