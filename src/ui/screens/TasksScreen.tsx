import { useGame } from '../../store/game';
import { content } from '../../data';
import { progressOf, isDone } from '../../engine/dailies';
import type { DailyDef } from '../../engine/content';
import type { GameState } from '../../engine/state';
import { Badge } from '../components/Badge';

function fillText(def: DailyDef): string {
  return def.text.replace('{n}', String(def.target));
}

function TaskRow({ taskId, state }: { taskId: string; state: GameState }) {
  const claimDaily = useGame((s) => s.claimDaily);
  const skipDaily = useGame((s) => s.skipDaily);
  const def = content.dailies.find((d) => d.id === taskId);
  const task = state.dailies.tasks.find((t) => t.id === taskId);
  if (!def || !task) return null;

  const progress = progressOf(state, def);
  const done = isDone(state, def);
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
        {state.dailies.skipTokens > 0 && !done && !task.claimed && (
          <button className="btn btn-ghost" aria-label={`Skip: ${text}`} onClick={() => skipDaily(taskId)}>
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

export function TasksScreen() {
  const state = useGame((s) => s.state);
  const { streak, bestStreak, skipTokens, tasks } = state.dailies;
  const unlocked = state.achievements.length;
  const total = content.achievements.length;

  return (
    <section className="screen tasks">
      <h2 className="visually-hidden">Tasks</h2>
      <div className="card">
        <h3>Daily tasks</h3>
        <p className="sub">Streak: {streak} days · Best: {bestStreak}</p>
        <p className="sub">Skip tokens: {skipTokens}</p>
      </div>
      {tasks.map((t) => <TaskRow key={t.id} taskId={t.id} state={state} />)}

      <div className="section-head">
        <h3>Achievements</h3>
        <span className="sub mono">{unlocked} / {total}</span>
      </div>
      <div className="badge-grid">
        {content.achievements.map((a) => {
          const isUnlocked = state.achievements.includes(a.id);
          return (
            <div key={a.id} className={'badge-tile' + (isUnlocked ? '' : ' locked')}>
              <Badge kind={a.badge} tier={a.tier} locked={!isUnlocked} />
              <span className="badge-name">{a.name}</span>
              <span className="sub badge-desc">{a.desc}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
