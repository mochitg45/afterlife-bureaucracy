import { memo, useMemo } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { progressOf, isDone, type DailyProgressView } from '../../engine/dailies';
import type { DailyDef } from '../../engine/content';
import { Badge } from '../components/Badge';
import { ScreenHeader } from '../components/ScreenHeader';

function fillText(def: DailyDef): string {
  return def.text.replace('{n}', String(def.target));
}

function TaskRow({ taskId, view }: { taskId: string; view: DailyProgressView }) {
  const claimDaily = useGame((s) => s.claimDaily);
  const skipDaily = useGame((s) => s.skipDaily);
  const def = content.dailies.find((d) => d.id === taskId);
  const task = view.dailies.tasks.find((t) => t.id === taskId);
  if (!def || !task) return null;

  const progress = progressOf(view, def);
  const done = isDone(view, def);
  const text = fillText(def);
  const pct = (Math.min(progress, def.target) / def.target) * 100;

  return (
    <div className="card daily-row">
      <p>{text}</p>
      <div className="bar"><div className="bar-fill" style={{ width: pct + '%' }} /></div>
      <div className="mono sub">{progress}/{def.target}</div>
      <div className="modal-actions">
        {task.claimed ? (
          <span className="mono claimed-label">Claimed</span>
        ) : (
          <button className="btn btn-primary" aria-label={`Claim: ${text}`} disabled={!done} onClick={() => claimDaily(taskId)}>
            Claim
          </button>
        )}
        {view.dailies.skipTokens > 0 && !done && !task.claimed && (
          <button className="btn btn-ghost" aria-label={`Skip: ${text}`} onClick={() => skipDaily(taskId)}>
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Eighty-odd badges that only ever change when an achievement unlocks. Memoised on the
 * unlocked-id set alone so the grid sits still through the ten-a-second tick loop.
 */
const AchievementGrid = memo(function AchievementGrid({ unlocked }: { unlocked: Set<string> }) {
  return (
    <div className="badge-grid">
      {content.achievements.map((a) => {
        const isUnlocked = unlocked.has(a.id);
        return (
          <div key={a.id} className={'badge-tile' + (isUnlocked ? '' : ' locked')}>
            <Badge kind={a.badge} tier={a.tier} locked={!isUnlocked} />
            <span className="badge-name">{a.name}</span>
            <span className="sub badge-desc">{a.desc}</span>
          </div>
        );
      })}
    </div>
  );
});

export function TasksScreen({ onSettings }: { onSettings?: () => void }) {
  // Three narrow subscriptions rather than the whole GameState: a tick changes kc and souls
  // on every fire, and none of this screen depends on either.
  const dailies = useGame((s) => s.state.dailies);
  const stats = useGame((s) => s.state.stats);
  const achievements = useGame((s) => s.state.achievements);
  const unlocked = useMemo(() => new Set(achievements), [achievements]);
  const { streak, bestStreak, skipTokens, tasks } = dailies;
  const view: DailyProgressView = { dailies, stats };
  const total = content.achievements.length;

  return (
    <section className="screen tasks">
      <ScreenHeader title="Tasks" onSettings={onSettings} />
      <div className="card">
        <h3>Daily tasks</h3>
        <p className="sub">Streak: {streak} days · Best: {bestStreak}</p>
        <p className="sub">Skip tokens: {skipTokens}</p>
      </div>
      {tasks.map((t) => <TaskRow key={t.id} taskId={t.id} view={view} />)}

      <div className="section-head">
        <h3>Achievements</h3>
        <span className="sub mono">{achievements.length} / {total}</span>
      </div>
      <AchievementGrid unlocked={unlocked} />
    </section>
  );
}
