import type { CSSProperties, ReactElement } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { formatNumber } from '../../engine/format';

const OUTLINE = 'var(--ink)';
const SW = 2.2;
/** One inked glyph per department, in the same outline style as the staff portraits. Unknown ids get the Intake tray. */
const GLYPHS: Record<string, ReactElement> = {
  intake: (
    <>
      <path d="M6 18 L9 9 H23 L26 18 V25 H6 Z" fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M6 18 H12 L14 21 H18 L20 18 H26" fill="none" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M12 5 H20 M12 9 H20" stroke={OUTLINE} strokeWidth={1.6} />
    </>
  ),
  heaven: (
    <>
      <ellipse cx={16} cy={7} rx={7} ry={2.6} fill="none" stroke="var(--brass)" strokeWidth={SW} />
      <path d="M8 24 a4 4 0 0 1 0-8 a5.5 5.5 0 0 1 10-3 a4.5 4.5 0 0 1 7 4 a3.5 3.5 0 0 1 0 7 Z" fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
    </>
  ),
  hell: (
    <>
      <path d="M16 4 C20 9 23 12 23 18 A7 7 0 0 1 9 18 C9 14 12 12 12 9 C14 11 15 12 15 14 C17 12 16 8 16 4 Z" fill="var(--red)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M16 26 V19 M13 19 V15 M16 19 V15 M19 19 V15 M13 15 H19" fill="none" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" />
    </>
  ),
  limbo: (
    <>
      <path d="M9 5 H23 V9 L17 16 L23 23 V27 H9 V23 L15 16 L9 9 Z" fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M12 24 H20 L16 19 Z" fill="var(--brass)" />
      <path d="M8 5 H24 M8 27 H24" stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" />
    </>
  ),
  reincarnation: (
    <>
      <path d="M24 14 A8 8 0 1 0 22 22" fill="none" stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" />
      <path d="M24 8 V14 H18" fill="none" stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 20 V14 M16 14 C13 14 12 11 12 10 C15 10 16 12 16 14 C16 12 17 10 20 10 C20 11 19 14 16 14" fill="var(--green)" stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round" />
    </>
  ),
  valhalla: (
    <>
      <path d="M8 18 A8 8 0 0 1 24 18 V22 H8 Z" fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M16 10 V22 M8 20 H24" stroke={OUTLINE} strokeWidth={1.6} />
      <path d="M8 14 C4 13 3 8 5 5 C6 9 8 10 9 11 M24 14 C28 13 29 8 27 5 C26 9 24 10 23 11" fill="var(--brass)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
    </>
  ),
};

function DeptIcon({ id }: { id: string }) {
  return (
    <svg className="chip-icon" viewBox="0 0 32 32" width={34} height={34} aria-hidden="true" data-glyph={id in GLYPHS ? id : 'intake'}>
      {GLYPHS[id] ?? GLYPHS.intake}
    </svg>
  );
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
    <div className="dept-chips" role="group" aria-label="Departments">
      {visible.map((d) => {
        const style = { '--accent': d.accent } as CSSProperties;
        if (unlocked.includes(d.id)) {
          return (
            <button key={d.id} className={'chip' + (active === d.id ? ' active' : '')} style={style} aria-pressed={active === d.id} onClick={() => setActiveDept(d.id)}>
              <DeptIcon id={d.id} />
              <span>{d.name}</span>
            </button>
          );
        }
        const progress = Math.min(1, soulsRun.div(d.unlockSouls).toNumber());
        return (
          <button key={d.id} className="chip locked" style={style} disabled aria-label={`${d.name} (locked, unlocks at ${formatNumber(d.unlockSouls)} souls)`}>
            <DeptIcon id={d.id} />
            <span className="chip-text">
              <span>{d.name}</span>
              <span className="mono sub">{formatNumber(d.unlockSouls)} souls</span>
            </span>
            <span className="bar"><span className="bar-fill" style={{ width: progress * 100 + '%' }} /></span>
          </button>
        );
      })}
    </div>
  );
}
