import { useState } from 'react';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { sealsForRun, AUDIT_THRESHOLD } from '../../engine/prestige';
import { PerkTree } from '../components/PerkTree';

export function LedgerScreen() {
  const seals = useGame((s) => s.state.seals);
  const year = useGame((s) => s.state.fiscalYear);
  const soulsRun = useGame((s) => s.state.soulsRun);
  const audit = useGame((s) => s.audit);
  const [confirming, setConfirming] = useState(false);
  const ready = soulsRun.gte(AUDIT_THRESHOLD);
  const preview = sealsForRun(soulsRun);
  const onAudit = () => {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    audit();
  };
  return (
    <section className="screen ledger">
      <h2 className="visually-hidden">Ledger</h2>
      <header className="currency-bar card">
        <div><div className="label">Karma Seals</div><div className="mono value brass">{seals} ◆</div></div>
        <div><div className="label">Fiscal Year</div><div className="mono value">{year}</div></div>
      </header>
      <div className="card audit-card">
        <h3>Fiscal Year Audit</h3>
        <p className="sub">Close the books. Staff, upgrades and departments reset; Seals, perks and vouchers stay.</p>
        {ready
          ? <div className="mono">Audit now for <strong>+{preview} Seals</strong></div>
          : <div className="mono sub">Need {formatNumber(AUDIT_THRESHOLD)} souls this run ({formatNumber(soulsRun)} so far)</div>}
        <div className="modal-actions">
          <button className={'btn ' + (confirming ? 'btn-primary' : '')} disabled={!ready} onClick={onAudit} aria-label="File Annual Audit">
            {confirming ? 'Confirm audit (resets the run)' : 'File Annual Audit'}
          </button>
          {confirming && <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>}
        </div>
      </div>
      <div className="section-head"><h3>Perk Ledger</h3><span className="sub">Spend Seals. Permanent.</span></div>
      <PerkTree />
      <div className="card cosmic-card">
        <h3>Cosmic Restructuring</h3>
        <p className="sub">Unlocks at 100 Seals. The Auditor has been asking questions.</p>
      </div>
    </section>
  );
}
