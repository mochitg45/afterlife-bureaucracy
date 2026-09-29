import { useEffect } from 'react';
import { useGame } from '../../store/game';
import { Badge } from './Badge';

/** How long an unlocked-achievement toast stays up before it clears itself. */
const TOAST_MS = 3000;

export function AchievementToast() {
  const achievement = useGame((s) => s.recentAchievements[0] ?? null);
  const clearAchievementToast = useGame((s) => s.clearAchievementToast);
  // Held while a popup is open (pull reveal, backlog report, audit, restructuring, Pip's gift): the toast
  // would sit on top of it. It shows, and starts its timer, once the popup closes.
  const held = useGame((s) => s.pendingPull !== null || s.pendingOffline !== null || s.lastAudit !== null || s.lastCosmic !== null || s.pendingVisitor !== null);

  useEffect(() => {
    if (!achievement || held) return;
    const timer = setTimeout(clearAchievementToast, TOAST_MS);
    return () => clearTimeout(timer);
  }, [achievement, held, clearAchievementToast]);

  if (!achievement || held) return null;
  return (
    <div className="toast" role="status">
      <Badge kind={achievement.badge} tier={achievement.tier} size={40} />
      <span className="toast-name">{achievement.name}</span>
    </div>
  );
}
