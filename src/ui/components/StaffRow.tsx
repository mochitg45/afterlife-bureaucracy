import Decimal from 'break_infinity.js';
import type { CSSProperties } from 'react';
import { useGame } from '../../store/game';
import type { StaffDef } from '../../engine/content';
import type { BuyMode } from '../../engine/actions';
import { staffBulkCost, maxAffordable, nextMilestone, prevMilestone, milestoneMult, canAfford } from '../../engine/economy';
import { formatNumber } from '../../engine/format';
import { Character } from '../characters/Character';
import { KarmaIcon } from '../icons/Currency';

const ZERO = new Decimal(0);

// Adventure Capitalist-style speed bar: purely visual, the economy already pays continuously.
// Base cycle period per staff slot (index within its department), halved at each ×2 milestone.
const BASE_PERIOD = [0.6, 1.2, 2.4, 4.8, 9.6];
const MIN_PERIOD = 0.15;
const MAX_SPEED_THRESHOLD = 0.25;

export function StaffRow({ staff, mode, index }: { staff: StaffDef; mode: BuyMode; index: number }) {
  const owned = useGame((s) => s.state.staff[staff.id] ?? 0);
  const kc = useGame((s) => s.state.kc);
  const rate = useGame((s) => s.rates.byStaff[staff.id] ?? ZERO, (a, b) => a.eq(b));
  const hire = useGame((s) => s.hire);
  const mood = useGame((s) => s.mood);
  const count = mode === 'max' ? maxAffordable(staff, owned, kc) : mode;
  const cost = staffBulkCost(staff, owned, Math.max(count, 1));
  const affordable = count > 0 && canAfford(cost, kc);
  const next = nextMilestone(owned);
  const prev = prevMilestone(owned);
  const progress = Math.min(1, (owned - prev) / (next - prev));
  const basePeriod = BASE_PERIOD[Math.min(index, BASE_PERIOD.length - 1)];
  const period = Math.max(basePeriod / milestoneMult(owned).toNumber(), MIN_PERIOD);
  const idle = owned === 0;
  const maxSpeed = !idle && period < MAX_SPEED_THRESHOLD;
  const speedLabel = idle
    ? `${formatNumber(rate)}/s`
    : maxSpeed
      ? `+${formatNumber(rate)}/s · MAX`
      : `+${formatNumber(rate.mul(period))} / ${period.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}s`;
  return (
    <div className="card staff-row" data-goal={`staff-${staff.id}`}>
      <Character id={staff.character} art={staff.id} mood={mood} size={52} />
      <div className="staff-info">
        <div className="milestone-bar" {...(index === 0 ? { 'data-coach': 'milestone' } : {})}>
          <div className="bar"><div className="bar-fill" style={{ width: progress * 100 + '%' }} /></div>
          <span className="mono milestone-label">×2 at {next}</span>
        </div>
        <div className="staff-name">{staff.name} <span className="mono owned">×{owned}</span></div>
        <div className="sub">{staff.role} — {staff.flavor}</div>
        <div
          className={`speed-bar${idle ? ' idle' : maxSpeed ? ' max' : ''}`}
          {...(index === 0 ? { 'data-coach': 'speed-bar' } : {})}
          style={{ '--period': `${period}s` } as CSSProperties}
        >
          <div className="speed-bar-fill" />
          <span className="speed-bar-label">{speedLabel}</span>
        </div>
      </div>
      {/* The training's step 1 points at Dave and only Dave: he is the one hire a new
          clerk can afford, and the only row guaranteed to be on the Personnel screen. */}
      <button
        className="btn hire"
        disabled={!affordable}
        onClick={() => hire(staff.id, mode)}
        aria-label={`Hire ${staff.name}`}
        {...(staff.id === 'dave' ? { 'data-coach': 'hire' } : {})}
      >
        <span>Hire {mode === 'max' ? (count || 1) : mode}</span>
        <span className="mono amt">{formatNumber(cost)} <KarmaIcon size={14} /></span>
      </button>
    </div>
  );
}
