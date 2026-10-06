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
import { t } from '../../i18n';

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
      <h3>{t('ledger.auditTitle')}</h3>
      <p className="sub">{t('ledger.auditDesc')}</p>
      {ready
        ? <div className="mono">{waiting ? t('ledger.willPay') : t('ledger.payNow')} <strong>{t('ledger.plusSeals', { n: preview })}</strong></div>
        : <div className="mono sub">{t('ledger.needSouls', { need: formatNumber(auditThreshold(year, cosmics)), have: formatNumber(soulsRun) })}</div>}
      {left > 0 && <div className="mono sub">{t('ledger.closesIn', { time: fmtLeft(left) })}</div>}
      <div className="modal-actions">
        <button className={'btn ' + (confirming === 'audit' ? 'btn-primary' : '')} disabled={!ready || waiting} onClick={onAudit} aria-label={t('ledger.fileAudit')}>
          {confirming === 'audit' ? t('ledger.confirmAudit') : t('ledger.fileAudit')}
        </button>
        {waiting && (
          <button className={'btn ' + (confirming === 'expedite' ? 'btn-primary' : '')} disabled={vouchers < cost} onClick={onExpedite} aria-label={t('ledger.expediteAria', { cost })}>
            {confirming === 'expedite'
              ? <>{t('ledger.confirmSpend', { cost })} <VoucherIcon size={14} /> {t('ledger.andAudit')}</>
              : <>{t('ledger.expediteNow', { cost })} <VoucherIcon size={14} /></>}
          </button>
        )}
        {confirming && <button className="btn btn-ghost" onClick={() => setConfirming(null)}>{t('ledger.cancel')}</button>}
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
      <button className="btn" disabled={busy} onClick={onClick}>{t('ledger.leaderboard')}</button>
      {failed && <span className="sub warn">{t('ledger.signIn')}</span>}
    </div>
  );
}

export function LedgerScreen({ onSettings }: { onSettings?: () => void }) {
  const seals = useGame((s) => s.state.seals);
  const year = useGame((s) => s.state.fiscalYear);
  return (
    <section className="screen ledger">
      <ScreenHeader title={t('ledger.title')} onSettings={onSettings} />
      <header className="currency-bar card">
        <div><div className="label">{t('ledger.karmaSeals')}</div><div className="mono value brass">{seals} <SealIcon size={20} /><span className="visually-hidden"> {t('ledger.sealsWord')}</span></div></div>
        <div><div className="label">{t('ledger.fiscalYear')}</div><div className="mono value">{year}</div></div>
      </header>
      <LeaderboardButton />
      <AuditCard />
      <div className="section-head"><h3>{t('ledger.perkLedger')}</h3><span className="sub">{t('ledger.perkHint')}</span></div>
      <PerkTree />
      <CosmicPanel />
    </section>
  );
}
