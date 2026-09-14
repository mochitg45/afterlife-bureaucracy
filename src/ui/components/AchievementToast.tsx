import { useEffect } from 'react';
import { useGame } from '../../store/game';
import { Badge } from './Badge';

/** How long an unlocked-achievement toast stays up before it clears itself. */
const TOAST_MS = 3000;

export function AchievementToast() {
  const achievement = useGame((s) => s.recentAchievements[0] ?? null);
  const clearAchievementToast = useGame((s) => s.clearAchievementToast);

  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(clearAchievementToast, TOAST_MS);
    return () => clearTimeout(timer);
  }, [achievement, clearAchievementToast]);

  if (!achievement) return null;
  return (
    <div className="toast" role="status">
      <Badge kind={achievement.badge} tier={achievement.tier} size={40} />
      <span className="toast-name">{achievement.name}</span>
    </div>
  );
}
