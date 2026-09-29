import { SealIcon } from '../icons/Currency';
import { useState } from 'react';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { sealsForRun, canAudit, auditThreshold } from '../../engine/prestige';
import { clauseSealMult } from '../../engine/cosmic';
import { content } from '../../data';
import { PerkTree } from '../components/PerkTree';
import { CosmicPanel } from '../components/CosmicPanel';
import { ScreenHeader } from '../components/ScreenHeader';

/**
 * The live half of the Ledger. Kept in its own component so the souls-this-run readout can
 * refresh at tick rate without dragging the forty-node Perk Ledger through a re-render.
 */
function AuditCard() {
  const year = useGame((s) => s.state.fiscalYear);
  const soulsRun = useGame((s) => s.state.soulsRun);
  // Narrow on purpose: the preview needs the Clause seal multiplier, not the whole state.
  const cosmicClauses = useGame((s) => s.state.cosmicClauses);
  const audit = useGame((s) => s.audit);
  const [confirming, setConfirming] = useState(false);
  const ready = canAudit({ soulsRun, fiscalYear: year });
  const preview = sealsForRun(soulsRun, year, clauseSealMult({ cosmicClauses }, content));
  const onAudit = () => {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    audit();
  };
  return (
    <div className="card audit-card" data-coach="audit">
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

/** Android only: opens the Play Games "Lifetime souls" board (signing in first if needed). */
function LeaderboardButton() {
  const available = useGame((s) => s.leaderboardAvailable);
  const open = useGame((s) => s.openLeaderboard);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!available) return null;
  const onClick = () => {
    setBusy(true);
    setFailed(false);
    void open().then((ok) => setFailed(!ok)).finally(() => setBusy(false));
  };
  return (
    <div className="leaderboard-row">
      <button className="btn" disabled={busy} onClick={onClick}>🏆 Leaderboard: lifetime souls</button>
      {failed && <span className="sub warn">Sign in to Play Games to see the leaderboard.</span>}
    </div>
  );
}

export function LedgerScreen({ onSettings }: { onSettings?: () => void }) {
  const seals = useGame((s) => s.state.seals);
  const year = useGame((s) => s.state.fiscalYear);
  return (
    <section className="screen ledger">
      <ScreenHeader title="Ledger" onSettings={onSettings} />
      <header className="currency-bar card">
        <div><div className="label">Karma Seals</div><div className="mono value brass">{seals} <SealIcon size={20} /><span className="visually-hidden"> seals</span></div></div>
        <div><div className="label">Fiscal Year</div><div className="mono value">{year}</div></div>
      </header>
      <LeaderboardButton />
      <AuditCard />
      <div className="section-head"><h3>Perk Ledger</h3><span className="sub">Spend Seals. Permanent.</span></div>
      <PerkTree />
      <CosmicPanel />
    </section>
  );
}
