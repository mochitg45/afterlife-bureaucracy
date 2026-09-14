import { memo } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { canBuyPerk } from '../../engine/perks';
import type { PerkBranch, PerkDef } from '../../engine/content';

const BRANCHES: Array<{ id: PerkBranch; title: string; blurb: string }> = [
  { id: 'throughput', title: 'Throughput', blurb: 'More souls per second, department by department.' },
  { id: 'overtime', title: 'Overtime', blurb: 'Longer, richer offline shifts.' },
  { id: 'stapler', title: 'Stapler', blurb: 'Heavier stamps.' },
  { id: 'requisition', title: 'Requisition', blurb: 'Vouchers and lanyards for the Personnel lottery.' },
  { id: 'headstart', title: 'Head Start', blurb: 'Skip the first morning of every fiscal year.' },
];

function perkName(id: string): string {
  return content.perks.find((p) => p.id === id)?.name ?? id;
}

// Memoised, and subscribed to Seals and perks only: the Ledger sits next to a readout that
// changes ten times a second, and there are about forty of these nodes on screen.
const PerkNode = memo(function PerkNode({ perk }: { perk: PerkDef }) {
  const seals = useGame((s) => s.state.seals);
  const perks = useGame((s) => s.state.perks);
  const buy = useGame((s) => s.buyPerk);
  const check = canBuyPerk({ seals, perks }, content, perk.id);
  const status = check.ok ? 'available' : check.reason === 'owned' ? 'owned' : check.reason === 'locked' ? 'locked' : 'unaffordable';
  return (
    <button className={`card perk ${status}`} disabled={!check.ok} onClick={() => buy(perk.id)} aria-label={perk.name}>
      <div className="perk-head">
        <span className="staff-name">{perk.name}</span>
        <span className="mono seal-cost">{status === 'owned' ? 'OWNED' : `${perk.cost} ◆`}</span>
      </div>
      <div className="sub">{perk.desc}</div>
      {status === 'locked' && <div className="sub">Requires {perk.requires.map(perkName).join(', ')}</div>}
    </button>
  );
});

export function PerkTree() {
  return (
    <div className="perk-tree">
      {BRANCHES.map((b) => (
        <section key={b.id} className="perk-branch">
          <div className="section-head"><h3>{b.title}</h3><span className="sub">{b.blurb}</span></div>
          {content.perks.filter((p) => p.branch === b.id).map((p) => <PerkNode key={p.id} perk={p} />)}
        </section>
      ))}
    </div>
  );
}
