import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import Decimal from 'break_infinity.js';
import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { findDepartment } from '../../engine/content';
import { formatNumber } from '../../engine/format';
import { nextMilestones, type Milestone as M } from '../../engine/milestones';
import './Milestone.css';

const AUTO_MS = 4000;
const COLORS = ['var(--brass)', 'var(--red)', 'var(--teal)', 'var(--green)', 'var(--violet)', '#E8C86A'];
const PIECES = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 29 + 7) % 100,
  delay: (((i * 53) % 100) / 100) * 0.9,
  dur: 2.2 + (((i * 37) % 10) / 10) * 1.4,
  rot: (i * 97) % 360,
  color: COLORS[i % COLORS.length],
}));

function labels(m: M): { title: string; sub: string; tag?: string } {
  if (m.kind === 'dept') {
    return { tag: t('milestone.dept'), title: findDepartment(content, m.id).name, sub: t('milestone.deptSub') };
  }
  const key = `milestone.souls.${m.tier}`;
  const named = t(key);
  return { title: named !== key ? named : t('milestone.soulsN', { n: formatNumber(Decimal.pow(10, m.tier * 3)) }), sub: t('milestone.soulsSub') };
}

export function MilestoneOverlay() {
  const ready = useGame((s) => s.ready);
  const souls = useGame((s) => s.state.soulsLifetime);
  const depts = useGame((s) => s.state.deptsUnlocked);
  const milestones = useGame((s) => s.state.milestones);
  const busy = useGame((s) => !!(s.pendingPull || s.lastAudit || s.lastCosmic || s.pendingOffline || s.pendingPrize || s.pendingVisitor));
  const [queue, setQueue] = useState<M[]>([]);

  useEffect(() => {
    if (!ready || busy) return;
    const { state } = useGame.getState();
    const { queue: found, next } = nextMilestones(state, content);
    if (next === state.milestones) return;
    useGame.setState((cur) => ({ state: { ...cur.state, milestones: next } }));
    if (found.length) setQueue((q) => [...q, ...found]);
  }, [ready, busy, souls, depts, milestones]);

  const cur = busy ? undefined : queue[0];
  const dismiss = () => {
    // A billion souls and beyond is a proud moment: a good time to ask for a rating.
    if (cur?.kind === 'souls' && cur.tier >= 3) useGame.getState().askReview('milestone');
    setQueue((q) => q.slice(1));
  };
  useEffect(() => {
    if (!cur) return;
    useGame.getState().audio?.play('milestone');
    const id = window.setTimeout(dismiss, AUTO_MS);
    return () => window.clearTimeout(id);
  }, [cur]);

  if (!cur) return null;
  const { title, sub, tag } = labels(cur);
  return (
    <div className="milestone" role="status" onClick={dismiss}>
      <div className="milestone-confetti" aria-hidden="true">
        {PIECES.map((p, i) => (
          <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, '--rot': `${p.rot}deg` } as CSSProperties} />
        ))}
      </div>
      <div className="milestone-banner">
        {tag && <div className="milestone-tag">{tag}</div>}
        <div className="milestone-title">{title}</div>
        <div className="milestone-sub">{sub}</div>
        <button className="btn btn-primary milestone-collect" onClick={(e) => { e.stopPropagation(); dismiss(); }}>{t('milestone.collect')}</button>
      </div>
    </div>
  );
}
