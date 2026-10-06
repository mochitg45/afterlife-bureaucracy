import { useMemo, useState } from 'react';
import { SealIcon } from '../icons/Currency';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { canBuyPerk, canUpgradePerk, perkLevel, perkUpgradable, perkValueAt, upgradeCost, MAX_PERK_LEVEL, type PerkWallet } from '../../engine/perks';
import { Modal } from './Modal';
import type { PerkBranch, PerkDef } from '../../engine/content';
import './PerkTree.css';
import { t } from '../../i18n';

const BRANCHES: Array<{ id: PerkBranch; title: string; blurb: string; x: number; y: number }> = [
  { id: 'throughput', title: t('perk.branch.throughput'), blurb: t('perk.branch.throughput.blurb'), x: 50, y: 13 },
  { id: 'overtime', title: t('perk.branch.overtime'), blurb: t('perk.branch.overtime.blurb'), x: 82, y: 37 },
  { id: 'stapler', title: t('perk.branch.stapler'), blurb: t('perk.branch.stapler.blurb'), x: 73, y: 71 },
  { id: 'requisition', title: t('perk.branch.requisition'), blurb: t('perk.branch.requisition.blurb'), x: 27, y: 71 },
  { id: 'headstart', title: t('perk.branch.headstart'), blurb: t('perk.branch.headstart.blurb'), x: 18, y: 37 },
];

type Status = 'owned' | 'available' | 'unaffordable' | 'locked';

const art = (file: string) => `${import.meta.env.BASE_URL}art/perks/${file}.webp`;
const perkName = (id: string) => content.perks.find((p) => p.id === id)?.name ?? id;

const trim = (n: number) => String(Math.round(n * 100) / 100);
const pct = (v: number) => `+${trim(v * 100)}%`;

/** The effect a perk delivers at a level, in the same words the perk's own description uses. */
function effectText(perk: PerkDef, level: number): string {
  const e = perk.effect;
  const v = perkValueAt(perk, level);
  switch (e.type) {
    case 'globalMult': return t('perk.fx.global', { v: pct(v) });
    case 'deptMult': return t('perk.fx.dept', { dept: content.departments.find((d) => d.id === e.dept)?.name ?? e.dept, v: pct(v) });
    case 'offlineCapHours': return t('perk.fx.offlineCap', { v: trim(v) });
    case 'offlineRate': return t('perk.fx.offlineRate', { v: pct(v) });
    case 'click': return t('perk.fx.click', { v: trim(v) });
    case 'voucherMult': return t('perk.fx.voucher', { v: pct(v) });
    default: return perk.desc;
  }
}

const ROW_H = 106;
const NODE_PAD = 44; // medallion centre of the first row, px from the top of the canvas
const MIN_GAP = 40; // % of the board width between two nodes on one row

interface Placed { perk: PerkDef; depth: number; x: number }

/**
 * Lays a branch out from its `requires` alone, so a new perk needs no hand-placed coordinates:
 * depth is the longest prerequisite chain above it, x follows the average of its parents and
 * is pushed apart where a row would crowd.
 */
function layout(perks: PerkDef[]): Placed[] {
  const byId = new Map(perks.map((p) => [p.id, p]));
  const depths = new Map<string, number>();
  const depthOf = (p: PerkDef): number => {
    const known = depths.get(p.id);
    if (known !== undefined) return known;
    const d = p.requires.reduce((m, r) => { const q = byId.get(r); return q ? Math.max(m, depthOf(q) + 1) : m; }, 0);
    depths.set(p.id, d);
    return d;
  };
  const xs = new Map<string, number>();
  const out: Placed[] = [];
  const maxDepth = Math.max(0, ...perks.map(depthOf));
  for (let d = 0; d <= maxDepth; d++) {
    const row = perks.filter((p) => depths.get(p.id) === d).map((p) => {
      const parents = p.requires.map((r) => xs.get(r)).filter((x): x is number => x !== undefined);
      return { p, want: parents.length ? parents.reduce((a, b) => a + b, 0) / parents.length : 50 };
    }).sort((a, b) => a.want - b.want);
    const pos = row.map((r) => r.want);
    for (let i = 1; i < pos.length; i++) pos[i] = Math.max(pos[i], pos[i - 1] + MIN_GAP);
    const shift = row.length ? row.reduce((s, r) => s + r.want, 0) / row.length - pos.reduce((s, x) => s + x, 0) / pos.length : 0;
    let moved = pos.map((x) => x + shift);
    const lo = Math.min(...moved), hi = Math.max(...moved);
    const fix = lo < 22 ? 22 - lo : hi > 78 ? 78 - hi : 0;
    moved = moved.map((x) => x + fix);
    row.forEach((r, i) => { xs.set(r.p.id, moved[i]); out.push({ perk: r.p, depth: d, x: moved[i] }); });
  }
  return out;
}

const canvasHeight = (nodes: Placed[]) => (Math.max(...nodes.map((n) => n.depth)) + 1) * ROW_H + 20;

function Edges({ nodes, status }: { nodes: Placed[]; status: (p: PerkDef) => Status }) {
  const at = new Map(nodes.map((n) => [n.perk.id, n]));
  const paths = nodes.flatMap((n) => n.perk.requires.map((r) => {
    const a = at.get(r);
    if (!a) return null;
    const y1 = NODE_PAD + a.depth * ROW_H, y2 = NODE_PAD + n.depth * ROW_H, my = (y1 + y2) / 2;
    const s = status(n.perk);
    const lit = status(a.perk) === 'owned' && (s === 'owned' || s === 'available');
    return { key: `${r}>${n.perk.id}`, lit, d: `M${a.x} ${y1} C${a.x} ${my} ${n.x} ${my} ${n.x} ${y2}` };
  })).filter((e): e is { key: string; lit: boolean; d: string } => e !== null);
  return (
    <svg className="pt-lines" viewBox={`0 0 100 ${canvasHeight(nodes)}`} preserveAspectRatio="none" aria-hidden="true">
      {paths.filter((e) => !e.lit).map((e) => <path key={e.key} className="pt-edge" d={e.d} />)}
      {paths.filter((e) => e.lit).map((e) => (
        <g key={e.key}><path className="pt-edge-glow" d={e.d} /><path className="pt-edge-lit" d={e.d} /><path className="pt-edge-core" d={e.d} /></g>
      ))}
    </svg>
  );
}

const STATE_WORD: Record<Status, string> = { owned: t('perk.state.owned'), locked: t('perk.state.locked'), available: t('perk.state.available'), unaffordable: t('perk.state.unaffordable') };

function BranchTree({ branch, status, wallet, onPick }: { branch: PerkBranch; status: (p: PerkDef) => Status; wallet: PerkWallet; onPick: (p: PerkDef) => void }) {
  const nodes = useMemo(() => layout(content.perks.filter((p) => p.branch === branch)), [branch]);
  return (
    <div className="pt-board pt-tree" style={{ height: canvasHeight(nodes) }}>
      <Edges nodes={nodes} status={status} />
      {nodes.map(({ perk, depth, x }) => {
        const s = status(perk);
        const level = perkLevel(wallet, perk.id);
        const showLevel = s === 'owned' && perkUpgradable(perk);
        const canUp = s === 'owned' && canUpgradePerk(wallet, content, perk.id).ok;
        const state = STATE_WORD[s];
        const label = s !== 'owned' ? t('perk.aria.cost', { name: perk.name, state, cost: perk.cost })
          : !showLevel ? t('perk.aria.owned', { name: perk.name, state })
            : t(canUp ? 'perk.aria.levelUp' : 'perk.aria.level', { name: perk.name, state, level });
        return (
          <button key={perk.id} className={`pt-node ${s}${canUp ? ' upgradable' : ''}`} style={{ left: `${x}%`, top: NODE_PAD + depth * ROW_H }} onClick={() => onPick(perk)} aria-label={label} data-testid={`perk-node-${perk.id}`} data-status={s} data-level={level} data-upgradable={canUp}>
            <span className="pt-med">
              <img src={art(branch)} alt="" draggable={false} />
              {s !== 'owned' && <span className="pt-price"><img src={art('hub')} alt="" />{perk.cost}</span>}
              {showLevel && <span className="pt-lv" data-testid={`perk-level-${perk.id}`}>{t('perk.lv', { n: level })}</span>}
            </span>
            <span className="pt-plate">{perk.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function Overview({ owned, onPick, seals }: { owned: Set<string>; onPick: (b: PerkBranch) => void; seals: number }) {
  const R = 34, C = 2 * Math.PI * R;
  return (
    <div className="pt-board pt-overview">
      <svg className="pt-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {BRANCHES.map((b) => <g key={b.id}><path className="pt-edge-glow" d={`M50 46 L${b.x} ${b.y}`} /><path className="pt-edge-lit" d={`M50 46 L${b.x} ${b.y}`} /></g>)}
      </svg>
      <div className="pt-hub"><img src={art('hub')} alt="" /><span className="pt-hub-v">{t('perk.hubSeals', { n: seals })}</span></div>
      {BRANCHES.map((b) => {
        const all = content.perks.filter((p) => p.branch === b.id);
        const n = all.filter((p) => owned.has(p.id)).length;
        return (
          <button key={b.id} className="pt-bnode" style={{ left: `${b.x}%`, top: `${b.y}%` }} onClick={() => onPick(b.id)} aria-label={t('perk.branchAria', { title: b.title, n, total: all.length })} data-testid={`perk-branch-${b.id}`}>
            <span className="pt-ring">
              <svg viewBox="0 0 78 78" aria-hidden="true">
                <circle cx="39" cy="39" r={R} className="pt-ring-bg" />
                <circle cx="39" cy="39" r={R} className="pt-ring-fg" strokeDasharray={`${(C * n) / all.length} ${C}`} />
              </svg>
              <img src={art(b.id)} alt="" />
              {n === all.length && <span className="pt-done">{t('perk.done')}</span>}
            </span>
            <span className="pt-plate">{b.title}</span>
            <span className="pt-cnt">{n} / {all.length}</span>
          </button>
        );
      })}
    </div>
  );
}

function Sheet({ perk, status, wallet, onClose }: { perk: PerkDef; status: Status; wallet: PerkWallet; onClose: () => void }) {
  const buy = useGame((s) => s.buyPerk);
  const upgrade = useGame((s) => s.upgradePerk);
  const { seals, perks: owned } = wallet;
  const level = perkLevel(wallet, perk.id);
  const upCheck = canUpgradePerk(wallet, content, perk.id);
  const upCost = upgradeCost(perk, level);
  const branch = BRANCHES.find((b) => b.id === perk.branch)!;
  const tier = layout(content.perks.filter((p) => p.branch === perk.branch)).find((n) => n.perk.id === perk.id)!.depth + 1;
  const missing = perk.requires.filter((r) => !owned.includes(r));
  let reason = '';
  if (status === 'owned') reason = t('perk.owned');
  else if (status === 'locked') reason = t('perk.lockedNeeds', { list: missing.map(perkName).join(t('perk.listJoin')) });
  else if (status === 'unaffordable') reason = t('perk.needMore', { n: perk.cost - seals });
  return (
    <Modal open title={perk.name} onClose={onClose} className={`perk-sheet ${status}`} backdropClassName="perk-sheet-bd"
      header={<span className="pt-big"><img src={art(perk.branch)} alt="" /></span>}>
      <div className="pt-br">{t('perk.sheetLine', { branch: branch.title, tier, status: status === 'unaffordable' ? t('perk.short') : status === 'available' ? t('perk.state.available') : status === 'owned' ? t('perk.state.owned') : t('perk.state.locked') })}</div>
      <div className="pt-fx">{status === 'owned' && perkUpgradable(perk) ? effectText(perk, level) : perk.desc}</div>
      {status === 'owned' && perkUpgradable(perk) && (
        <div className="pt-req" data-testid="perk-levels">
          <div><span>{t('perk.level')}</span><span>{level} / {MAX_PERK_LEVEL}</span></div>
          <div><span>{t('perk.now')}</span><span>{effectText(perk, level)}</span></div>
          {level < MAX_PERK_LEVEL && <div><span>{t('perk.nextLevel')}</span><span>{effectText(perk, level + 1)}</span></div>}
          {level < MAX_PERK_LEVEL && <div><span>{t('perk.upgrade')} <SealIcon size={14} /></span><span className={upCheck.ok ? 'ok' : 'no'}>{t('perk.costHave', { cost: upCost, seals })}</span></div>}
        </div>
      )}
      <div className="pt-req">
        {perk.requires.map((r) => (
          <div key={r}><span>{perkName(r)}</span><span className={owned.includes(r) ? 'ok' : 'no'}>{owned.includes(r) ? t('perk.owned') : t('perk.missing')}</span></div>
        ))}
        {perk.requires.length === 0 && <div><span>{t('perk.startPerk')}</span><span className="ok">{t('perk.noPrereq')}</span></div>}
        <div><span>{t('perk.price')} <SealIcon size={14} /></span><span className={status === 'owned' || seals >= perk.cost ? 'ok' : 'no'}>{t('perk.costHave', { cost: perk.cost, seals })}</span></div>
      </div>
      {status === 'owned' && perkUpgradable(perk) ? (
        <button className="btn btn-primary pt-buy" data-testid="perk-upgrade" disabled={!upCheck.ok} onClick={() => upgrade(perk.id)}>
          {upCheck.ok ? <>{t('perk.upgradeTo', { n: level + 1, cost: upCost })} <SealIcon size={16} /></>
            : upCheck.reason === 'max' ? t('perk.maxLevel') : t('perk.needMore', { n: upCost - seals })}
        </button>
      ) : (
        <button className="btn btn-primary pt-buy" data-testid="perk-buy" disabled={status !== 'available'}
          onClick={() => { buy(perk.id); onClose(); }}>
          {status === 'available' ? <>{t('perk.buyFor', { cost: perk.cost })} <SealIcon size={16} /></> : reason}
        </button>
      )}
      <button className="btn btn-ghost pt-close" onClick={onClose}>{t('perk.close')}</button>
    </Modal>
  );
}

export function PerkTree() {
  const seals = useGame((s) => s.state.seals);
  const perks = useGame((s) => s.state.perks);
  const perkLevels = useGame((s) => s.state.perkLevels);
  const wallet: PerkWallet = { seals, perks, perkLevels };
  const [view, setView] = useState<'all' | PerkBranch>('all');
  const [picked, setPicked] = useState<PerkDef | null>(null);
  const owned = useMemo(() => new Set(perks), [perks]);
  const status = (p: PerkDef): Status => {
    const c = canBuyPerk({ seals, perks }, content, p.id);
    return c.ok ? 'available' : c.reason === 'owned' ? 'owned' : c.reason === 'locked' ? 'locked' : 'unaffordable';
  };
  const branch = BRANCHES.find((b) => b.id === view);
  const count = (id: PerkBranch) => content.perks.filter((p) => p.branch === id && owned.has(p.id)).length;
  const total = (id: PerkBranch) => content.perks.filter((p) => p.branch === id).length;
  return (
    <div className="perk-tree">
      <div className="pt-tabs" role="group" aria-label={t('perk.branchesAria')}>
        <button className={`pt-tab${view === 'all' ? ' on' : ''}`} aria-pressed={view === 'all'} onClick={() => setView('all')}>
          <img src={art('hub')} alt="" /><span>{t('perk.all')}</span><small>{perks.length}/{content.perks.length}</small>
        </button>
        {BRANCHES.map((b) => (
          <button key={b.id} className={`pt-tab${view === b.id ? ' on' : ''}`} aria-pressed={view === b.id} data-testid={`perk-tab-${b.id}`} onClick={() => setView(b.id)}>
            <img src={art(b.id)} alt="" /><span>{b.title}</span><small>{count(b.id)}/{total(b.id)}</small>
          </button>
        ))}
      </div>
      {branch ? <BranchTree branch={branch.id} status={status} wallet={wallet} onPick={setPicked} /> : <Overview owned={owned} seals={seals} onPick={setView} />}
      <div className="pt-foot">
        <span>{branch ? t('perk.footBranch', { title: branch.title, count: count(branch.id), total: total(branch.id) }) : t('perk.footAll', { count: perks.length, total: content.perks.length })}</span>
        <span>{branch ? branch.blurb : t('perk.tapBranch')}</span>
      </div>
      {picked && <Sheet perk={picked} status={status(picked)} wallet={wallet} onClose={() => setPicked(null)} />}
    </div>
  );
}
