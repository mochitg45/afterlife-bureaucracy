import Decimal from 'break_infinity.js';
import { useGame } from '../../store/game';
import type { StaffDef } from '../../engine/content';
import type { BuyMode } from '../../engine/actions';
import { staffBulkCost, maxAffordable, nextMilestone, prevMilestone } from '../../engine/economy';
import { formatNumber } from '../../engine/format';
import { Character } from '../characters/Character';

const ZERO = new Decimal(0);

export function StaffRow({ staff, mode }: { staff: StaffDef; mode: BuyMode }) {
  const owned = useGame((s) => s.state.staff[staff.id] ?? 0);
  const kc = useGame((s) => s.state.kc);
  const rate = useGame((s) => s.rates.byStaff[staff.id] ?? ZERO, (a, b) => a.eq(b));
  const hire = useGame((s) => s.hire);
  const mood = useGame((s) => s.mood);
  const count = mode === 'max' ? maxAffordable(staff, owned, kc) : mode;
  const cost = staffBulkCost(staff, owned, Math.max(count, 1));
  const affordable = count > 0 && cost.lte(kc);
  const next = nextMilestone(owned);
  const prev = prevMilestone(owned);
  const progress = Math.min(1, (owned - prev) / (next - prev));
  return (
    <div className="card staff-row">
      <Character id={staff.character} mood={mood} size={52} />
      <div className="staff-info">
        <div className="staff-name">{staff.name} <span className="mono owned">×{owned}</span></div>
        <div className="sub">{staff.role} — {staff.flavor}</div>
        <div className="mono sub">{formatNumber(rate)}/s · next ×2 at {next}</div>
        <div className="bar"><div className="bar-fill" style={{ width: progress * 100 + '%' }} /></div>
      </div>
      <button className="btn hire" disabled={!affordable} onClick={() => hire(staff.id, mode)} aria-label={`Hire ${staff.name}`}>
        <span>Hire {mode === 'max' ? (count || 1) : mode}</span>
        <span className="mono">{formatNumber(cost)}</span>
      </button>
    </div>
  );
}
