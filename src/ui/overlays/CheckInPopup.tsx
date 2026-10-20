import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { loginClaimable } from '../../engine/login';
import { CheckIn } from '../screens/TasksScreen';
import { PrizePopup } from '../screens/EventScreen';
import './CheckInPopup.css';

/** One check-in pop-up per app open; module state so remounts never repeat it. */
let shownThisOpen = false;
export function resetCheckInSession(): void { shownThisOpen = false; }

/**
 * The 7-day check-in, popped up when the app opens while today's reward is unclaimed (after
 * the tutorial), like most mobile games. Claiming closes it; once claimed it stays away until
 * tomorrow. Closing without claiming just waits for the next app open. The store offer
 * pop-up holds back while this is up.
 */
export function CheckInPopup() {
  const ready = useGame((s) => s.ready);
  const busy = useGame((s) => !!(s.pendingPull || s.lastAudit || s.lastCosmic || s.pendingOffline || s.pendingPrize || s.pendingVisitor));
  const step = useGame((s) => s.state.onboarding.trainingStep);
  const claimable = useGame((s) => loginClaimable(s.state));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shownThisOpen || !ready || busy || step < 3 || !claimable) return;
    // Keeps checking until the screen is clear (a milestone banner or report may be up first).
    const id = window.setInterval(() => {
      if (shownThisOpen) { window.clearInterval(id); return; }
      if (document.querySelector('.milestone, .modal-backdrop, .offer, .whatsnew')) return;
      window.clearInterval(id);
      shownThisOpen = true;
      setOpen(true);
    }, 700);
    return () => window.clearInterval(id);
  }, [ready, busy, step, claimable]);

  // Claiming queues the reward card (pendingPrize), which is only drawn on the Tasks and Event
  // screens; show it here, then close once it's collected so nothing waits on it unseen.
  const prize = useGame((s) => s.pendingPrize);
  useEffect(() => {
    if (open && !claimable && !prize) setOpen(false);
  }, [open, claimable, prize]);

  if (!open) return null;
  if (!claimable && prize) return <PrizePopup title={t('login.prizeTitle')} />;
  return (
    <div className="checkin-pop" role="dialog" aria-modal="true" aria-label={t('login.title')} onClick={() => setOpen(false)}>
      <div className="checkin-pop-card" onClick={(e) => e.stopPropagation()}>
        <button className="checkin-pop-close" aria-label={t('settings.close')} onClick={() => setOpen(false)}>×</button>
        <CheckIn />
      </div>
    </div>
  );
}
