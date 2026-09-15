import { memo, useState } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { canBuyClause, canCosmic, CLAUSE_COST, COSMIC_THRESHOLD } from '../../engine/cosmic';
import type { ClauseDef } from '../../engine/content';

function clauseName(id: string): string {
  return content.clauses.find((c) => c.id === id)?.name ?? id;
}

/**
 * One Clause. Subscribed to the two cosmic fields alone: the Ledger sits next to a readout
 * that moves ten times a second and there is one of these per Clause.
 */
const ClauseNode = memo(function ClauseNode({ clause }: { clause: ClauseDef }) {
  const cosmicPoints = useGame((s) => s.state.cosmicPoints);
  const cosmicClauses = useGame((s) => s.state.cosmicClauses);
  const buyClause = useGame((s) => s.buyClause);
  const check = canBuyClause({ cosmicPoints, cosmicClauses }, content, clause.id);
  const status = check.ok ? 'available' : check.reason === 'owned' ? 'owned' : check.reason === 'locked' ? 'locked' : 'unaffordable';
  return (
    <div className={`card clause ${status}`}>
      <div className="perk-head">
        <span className="staff-name">{clause.name}</span>
        <span className="mono seal-cost">{status === 'owned' ? 'ENACTED' : `${CLAUSE_COST} ✦`}</span>
      </div>
      <div className="sub">{clause.desc}</div>
      {status === 'locked' && <div className="sub">Requires {clause.requires.map(clauseName).join(', ')}</div>}
      <div className="modal-actions">
        <button className="btn" disabled={!check.ok} aria-label={`Enact ${clause.name}`} onClick={() => buyClause(clause.id)}>
          Enact
        </button>
      </div>
    </div>
  );
});

/**
 * The second prestige tier, sitting under the Perk Ledger. Locked until the Seal threshold,
 * then a two-step confirm — restructuring hands back every Seal and Perk the player owns, so
 * it is never one stray tap away.
 */
export function CosmicPanel() {
  const seals = useGame((s) => s.state.seals);
  const cosmicPoints = useGame((s) => s.state.cosmicPoints);
  const restructure = useGame((s) => s.cosmic);
  const [confirming, setConfirming] = useState(false);
  const ready = canCosmic({ seals });
  const pct = Math.min(100, (seals / COSMIC_THRESHOLD) * 100);

  const onRestructure = () => {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    restructure();
  };

  return (
    <section className="cosmic-panel">
      <div className={'card cosmic-card' + (ready ? ' ready' : '')}>
        <h3>Cosmic Restructuring</h3>
        {ready ? (
          <>
            <p className="sub">The Auditor has stopped asking questions. That is worse.</p>
            {confirming && (
              <p className="sub warn">
                Resets your Seals, every Perk, and the run: staff, upgrades and departments. Vouchers, cards,
                lifetime souls, Clauses and the fiscal year stay.
              </p>
            )}
            <div className="modal-actions">
              <button
                className={'btn ' + (confirming ? 'btn-primary' : '')}
                aria-label="Restructure (+1 Clause point)"
                onClick={onRestructure}
              >
                {confirming ? 'Confirm restructuring' : 'Restructure (+1 Clause point)'}
              </button>
              {confirming && <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>}
            </div>
          </>
        ) : (
          <>
            <p className="sub">Unlocks at 100 Seals. The Auditor has been asking questions.</p>
            <div className="bar"><div className="bar-fill" style={{ width: pct + '%' }} /></div>
            <div className="mono sub">{seals} / {COSMIC_THRESHOLD} Seals</div>
          </>
        )}
      </div>
      <div className="section-head">
        <h3>Clauses</h3>
        <span className="mono brass">Clause points: {cosmicPoints}</span>
      </div>
      {content.clauses.map((c) => <ClauseNode key={c.id} clause={c} />)}
    </section>
  );
}
