import type { CSSProperties } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { formatNumber } from '../../engine/format';

export function DeptChips() {
  const unlocked = useGame((s) => s.state.deptsUnlocked);
  const active = useGame((s) => s.state.activeDept);
  const soulsRun = useGame((s) => s.state.soulsRun);
  const setActiveDept = useGame((s) => s.setActiveDept);
  return (
    <div className="dept-chips" role="group" aria-label="Departments">
      {content.departments.map((d) => {
        const style = { '--accent': d.accent } as CSSProperties;
        if (unlocked.includes(d.id)) {
          return (
            <button key={d.id} className={'chip' + (active === d.id ? ' active' : '')} style={style} aria-pressed={active === d.id} onClick={() => setActiveDept(d.id)}>
              {d.name}
            </button>
          );
        }
        const progress = Math.min(1, soulsRun.div(d.unlockSouls).toNumber());
        return (
          <button key={d.id} className="chip locked" style={style} disabled aria-label={`${d.name} (locked, unlocks at ${formatNumber(d.unlockSouls)} souls)`}>
            <span>{d.name}</span>
            <span className="mono sub">{formatNumber(d.unlockSouls)} souls</span>
            <span className="bar"><span className="bar-fill" style={{ width: progress * 100 + '%' }} /></span>
          </button>
        );
      })}
    </div>
  );
}
