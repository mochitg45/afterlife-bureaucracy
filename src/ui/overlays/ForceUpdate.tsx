import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { checkUpdate, startUpdate } from '../../platform/appUpdate';
import { StampSeal } from '../components/StampButton';
import './ForceUpdate.css';

/**
 * Blocks play while Google Play has a newer version: checks on launch and every time the game
 * returns to the foreground, opens Play's updater once on its own, and otherwise sits on top of
 * everything with a single Update button. No close button by design.
 */
export function ForceUpdate() {
  const [required, setRequired] = useState(false);

  useEffect(() => {
    let prompted = false;
    const check = async () => {
      const need = await checkUpdate();
      setRequired(need);
      if (need && !prompted) {
        prompted = true;
        void startUpdate();
      }
    };
    void check();
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  if (!required) return null;
  return (
    <div className="force-update" role="alertdialog" aria-modal="true" aria-labelledby="force-update-title">
      <div className="force-update-card">
        <StampSeal className="force-update-seal" size={72} />
        <h2 id="force-update-title">{t('update.title')}</h2>
        <p>{t('update.body')}</p>
        <button className="btn btn-primary" onClick={() => void startUpdate()}>{t('update.button')}</button>
      </div>
    </div>
  );
}
