import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { APP_VERSION } from '../../version';
import './CheckInPopup.css';

const KEY = 'whatsNewSeen';
const read = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v: string): void => { try { localStorage.setItem(KEY, v); } catch { /* private mode: shows again next open */ } };

/**
 * "What's new" notes, popped once per app version on the first open after an update. A brand-new
 * player (still in the tutorial) has nothing to compare against, so the version is just recorded.
 * Every release adds `whatsnew.notes` in all locales; the check-in and offer pop-ups wait for it.
 */
export function WhatsNew() {
  const ready = useGame((s) => s.ready);
  const step = useGame((s) => s.state.onboarding.trainingStep);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready || read() === APP_VERSION) return;
    write(APP_VERSION);
    if (step >= 3) setOpen(true);
  }, [ready, step]);

  if (!open) return null;
  const notes = t('whatsnew.notes').split('\n').filter(Boolean);
  return (
    <div className="checkin-pop whatsnew" role="dialog" aria-modal="true" aria-labelledby="whatsnew-title" onClick={() => setOpen(false)}>
      <div className="checkin-pop-card" onClick={(e) => e.stopPropagation()}>
        <button className="checkin-pop-close" aria-label={t('settings.close')} onClick={() => setOpen(false)}>×</button>
        <section className="card whatsnew-card">
          <h2 id="whatsnew-title">{t('whatsnew.title', { version: APP_VERSION })}</h2>
          <ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
          <button className="btn btn-primary" onClick={() => setOpen(false)}>{t('whatsnew.ok')}</button>
        </section>
      </div>
    </div>
  );
}
