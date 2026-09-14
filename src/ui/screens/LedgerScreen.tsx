import { useState } from 'react';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { sealsForRun, canAudit, auditThreshold } from '../../engine/prestige';
import { PerkTree } from '../components/PerkTree';

/**
 * The live half of the Ledger. Kept in its own component so the souls-this-run readout can
 * refresh at tick rate without dragging the forty-node Perk Ledger through a re-render.
 */
function AuditCard() {
  const year = useGame((s) => s.state.fiscalYear);
  const soulsRun = useGame((s) => s.state.soulsRun);
  const audit = useGame((s) => s.audit);
  const [confirming, setConfirming] = useState(false);
  const ready = canAudit({ soulsRun, fiscalYear: year });
  const preview = sealsForRun(soulsRun, year);
  const onAudit = () => {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    audit();
  };
  return (
    <div className="card audit-card">
      <h3>Fiscal Year Audit</h3>
      <p className="sub">Close the books. Staff, upgrades and departments reset; Seals, perks and vouchers stay.</p>
      {ready
        ? <div className="mono">Audit now for <strong>+{preview} Seals</strong></div>
        : <div className="mono sub">Need {formatNumber(auditThreshold(year))} souls this run ({formatNumber(soulsRun)} so far)</div>}
      <div className="modal-actions">
        <button className={'btn ' + (confirming ? 'btn-primary' : '')} disabled={!ready} onClick={onAudit} aria-label="File Annual Audit">
          {confirming ? 'Confirm audit (resets the run)' : 'File Annual Audit'}
        </button>
        {confirming && <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>}
      </div>
    </div>
  );
}

export function LedgerScreen() {
  const seals = useGame((s) => s.state.seals);
  const year = useGame((s) => s.state.fiscalYear);
  return (
    <section className="screen ledger">
      <h2 className="visually-hidden">Ledger</h2>
      <header className="currency-bar card">
        <div><div className="label">Karma Seals</div><div className="mono value brass">{seals} ◆</div></div>
        <div><div className="label">Fiscal Year</div><div className="mono value">{year}</div></div>
      </header>
      <AuditCard />
      <div className="section-head"><h3>Perk Ledger</h3><span className="sub">Spend Seals. Permanent.</span></div>
      <PerkTree />
      <div className="card cosmic-card">
        <h3>Cosmic Restructuring</h3>
        <p className="sub">Unlocks at 100 Seals. The Auditor has been asking questions.</p>
      </div>
    </section>
  );
}
