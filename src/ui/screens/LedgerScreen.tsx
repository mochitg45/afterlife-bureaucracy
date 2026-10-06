import { SealIcon } from '../icons/Currency';
import { useEffect, useState } from 'react';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { sealsForRun, canAudit, auditThreshold, auditTimeLeftMs, expediteCost } from '../../engine/prestige';
import { fmtLeft } from '../format';
import { VoucherIcon } from '../icons/Currency';
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
  const runStartWall = useGame((s) => s.state.runStartWall);
  const cosmics = useGame((s) => s.state.stats.cosmics);
  const vouchers = useGame((s) => s.state.vouchers);
  const audit = useGame((s) => s.audit);
  const expedite = useGame((s) => s.expediteAudit);
  // Which button is waiting on its second tap: both reset the run, so both confirm.
  const [confirming, setConfirming] = useState<'audit' | 'expedite' | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const ready = canAudit({ soulsRun, fiscalYear: year, stats: { cosmics } });
  const left = auditTimeLeftMs({ runStartWall }, now);
  const waiting = ready && left > 0;
  const cost = expediteCost({ runStartWall }, now);
  const preview = sealsForRun(soulsRun, year, clauseSealMult({ cosmicClauses }, content), cosmics);

  // The only clock on this screen, and it runs only while the fiscal year is counting down.
  useEffect(() => {
    if (left <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [left > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const onAudit = () => {
    if (confirming !== 'audit') { setConfirming('audit'); return; }
    setConfirming(null);
    audit();
  };
  const onExpedite = () => {
    if (confirming !== 'expedite') { setConfirming('expedite'); return; }
    setConfirming(null);
    expedite();
  };
  return (
    <div className="card audit-card" data-coach="audit">
      <h3>Fiscal Year Audit</h3>
      <p className="sub">Close the books. Staff, upgrades and departments reset; Seals, perks and vouchers stay.</p>
      {ready
        ? <div className="mono">Audit {waiting ? 'will pay' : 'now for'} <strong>+{preview} Seals</strong></div>
        : <div className="mono sub">Need {formatNumber(auditThreshold(year, cosmics))} souls this run ({formatNumber(soulsRun)} so far)</div>}
      {left > 0 && <div className="mono sub">Fiscal year closes in {fmtLeft(left)}</div>}
      <div className="modal-actions">
        <button className={'btn ' + (confirming === 'audit' ? 'btn-primary' : '')} disabled={!ready || waiting} onClick={onAudit} aria-label="File Annual Audit">
          {confirming === 'audit' ? 'Confirm audit (resets the run)' : 'File Annual Audit'}
        </button>
        {waiting && (
          <button className={'btn ' + (confirming === 'expedite' ? 'btn-primary' : '')} disabled={vouchers < cost} onClick={onExpedite} aria-label={`Expedite the audit for ${cost} vouchers`}>
            {confirming === 'expedite'
              ? <>Confirm: spend {cost} <VoucherIcon size={14} /> and audit</>
              : <>Expedite now · {cost} <VoucherIcon size={14} /></>}
          </button>
        )}
        {confirming && <button className="btn btn-ghost" onClick={() => setConfirming(null)}>Cancel</button>}
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
