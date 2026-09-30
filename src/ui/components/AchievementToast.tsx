import { useEffect } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { voucherMult } from '../../engine/vouchers';
import { Badge } from './Badge';
import { VoucherIcon } from '../icons/Currency';

/** How long an unlocked-achievement popup stays up before it clears itself. */
const TOAST_MS = 4000;

/**
 * "Achievement unlocked" popup: badge, name, what it was for, and the vouchers it paid, so the
 * player knows what they got. Non-blocking (no backdrop); tap to close early.
 */
export function AchievementToast() {
  const achievement = useGame((s) => s.recentAchievements[0] ?? null);
  const clearAchievementToast = useGame((s) => s.clearAchievementToast);
  // Held while a popup is open (pull reveal, backlog report, audit, restructuring, Pip's gift):
  // the toast would sit on top of it. It shows, and starts its timer, once the popup closes.
  const held = useGame((s) => s.pendingPull !== null || s.pendingOffline !== null || s.lastAudit !== null || s.lastCosmic !== null || s.pendingVisitor !== null);
  // What the grant paid at the player's current multiplier (the engine carries fractions, so
  // this can be one off from the exact payout; close enough for a headline).
  const paid = useGame((s) => (achievement?.vouchers ? Math.floor(achievement.vouchers * voucherMult(s.state, content)) : 0));

  useEffect(() => {
    if (!achievement || held) return;
    const timer = setTimeout(clearAchievementToast, TOAST_MS);
    return () => clearTimeout(timer);
  }, [achievement, held, clearAchievementToast]);

  if (!achievement || held) return null;
  return (
    <button className="toast ach-toast" role="status" onClick={clearAchievementToast}>
      <Badge kind={achievement.badge} tier={achievement.tier} size={48} />
      <span className="ach-body">
        <span className="ach-label">Achievement unlocked</span>
        <span className="toast-name">{achievement.name}</span>
        {achievement.desc && <span className="ach-desc">{achievement.desc}</span>}
      </span>
      {paid > 0 && (
        <span className="ach-reward" aria-label={`plus ${paid} vouchers`}>+{paid} <VoucherIcon size={16} /></span>
      )}
    </button>
  );
}
