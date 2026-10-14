import type { CSSProperties } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { formatNumber } from '../../engine/format';
import { t } from '../../i18n';

/** Painted wax-seal badges, one per department (public/art/depts/icons). Unknown ids get the Intake tray. */
const ICONS = new Set(['intake', 'heaven', 'hell', 'limbo', 'reincarnation', 'valhalla']);

function DeptIcon({ id }: { id: string }) {
  const glyph = ICONS.has(id) ? id : 'intake';
  return <img className="chip-icon" src={`art/depts/icons/${glyph}.webp`} alt="" aria-hidden="true" data-glyph={glyph} draggable={false} />;
}

/** "Heaven Admissions" → "Heaven": the tab row fits every department on a phone, so labels stay one word. */
function shortName(id: string, name: string): string {
  const key = `dept.short.${id}`;
  const short = t(key);
  return short !== key ? short : name.split(' ')[0];
}

export function DeptChips() {
  const unlocked = useGame((s) => s.state.deptsUnlocked);
  const active = useGame((s) => s.state.activeDept);
  const soulsRun = useGame((s) => s.state.soulsRun);
  const branches = useGame((s) => s.state.branchesUnlocked);
  const setActiveDept = useGame((s) => s.setActiveDept);
  // A branch department is not a locked chip with a soul target on it — it does not exist
  // until a Cosmic Clause opens the branch, so it must not spoil itself from day one.
  const visible = content.departments.filter((d) => !d.branch || branches.includes(d.branch));
  return (
    <div className="dept-chips" role="group" aria-label={t('dept.groupAria')} style={{ '--n': visible.length } as CSSProperties}>
      {visible.map((d) => {
        const style = { '--accent': d.accent } as CSSProperties;
        if (unlocked.includes(d.id)) {
          return (
            <button
              key={d.id}
              className={'chip' + (active === d.id ? ' active' : '')}
              style={style}
              aria-label={d.name}
              // The newest department, for the beginner tip that announces it.
              {...(unlocked.length > 1 && d.id === unlocked[unlocked.length - 1] ? { 'data-coach': 'dept-new' } : {})} aria-pressed={active === d.id} onClick={() => setActiveDept(d.id)}>
              <DeptIcon id={d.id} />
              <span className="chip-name">{shortName(d.id, d.name)}</span>
            </button>
          );
        }
        // Souls this run, not the lifetime total in the header: an audit resets the run
        // and closes departments again, which read as a bug when only the target showed.
        const progress = Math.min(1, soulsRun.div(d.unlockSouls).toNumber());
        return (
          <button key={d.id} className="chip locked" style={style} disabled data-goal={`dept-${d.id}`} aria-label={t('dept.lockedAria', { name: d.name, need: formatNumber(d.unlockSouls), have: formatNumber(soulsRun) })}>
            <DeptIcon id={d.id} />
            <span className="chip-name mono">{formatNumber(d.unlockSouls)}</span>
            <span className="bar"><span className="bar-fill" style={{ width: progress * 100 + '%' }} /></span>
          </button>
        );
      })}
    </div>
  );
}
