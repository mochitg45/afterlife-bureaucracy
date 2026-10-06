import { memo, useState } from 'react';
import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { canBuyClause, canCosmic, CLAUSE_COST, cosmicThreshold } from '../../engine/cosmic';
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
        <span className="mono seal-cost">{status === 'owned' ? t('cosmic.enacted') : `${CLAUSE_COST} ✦`}</span>
      </div>
      <div className="sub">{clause.desc}</div>
      {status === 'locked' && <div className="sub">{t('cosmic.requires', { names: clause.requires.map(clauseName).join(', ') })}</div>}
      <div className="modal-actions">
        <button className="btn" disabled={!check.ok} aria-label={t('cosmic.enactAria', { name: clause.name })} onClick={() => buyClause(clause.id)}>
          {t('cosmic.enact')}
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
  const held = useGame((s) => s.state.seals);
  const invested = useGame((s) => s.state.sealsInvested);
  // Seals sunk into perk levels count toward the threshold, so the bar shows the same total.
  const seals = held + invested;
  // The threshold grows with every filing, so the panel has to know how many have been filed
  // to show the number the engine will actually check. One more narrow number subscription.
  const cosmics = useGame((s) => s.state.stats.cosmics);
  const cosmicPoints = useGame((s) => s.state.cosmicPoints);
  const restructure = useGame((s) => s.cosmic);
  const [confirming, setConfirming] = useState(false);
  const threshold = cosmicThreshold(cosmics);
  const ready = canCosmic({ seals: held, sealsInvested: invested, stats: { cosmics } });
  const pct = Math.min(100, (seals / threshold) * 100);

  const onRestructure = () => {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    restructure();
  };

  return (
    <section className="cosmic-panel">
      <div className={'card cosmic-card' + (ready ? ' ready' : '')}>
        <h3>{t('cosmic.title')}</h3>
        {ready ? (
          <>
            <p className="sub">{t('cosmic.ready')}</p>
            {confirming && (
              <p className="sub warn">
                {t('cosmic.warn')}
              </p>
            )}
            <div className="modal-actions">
              <button
                className={'btn ' + (confirming ? 'btn-primary' : '')}
                aria-label={t('cosmic.restructure')}
                onClick={onRestructure}
              >
                {confirming ? t('cosmic.confirm') : t('cosmic.restructure')}
              </button>
              {confirming && <button className="btn btn-ghost" onClick={() => setConfirming(false)}>{t('cosmic.cancel')}</button>}
            </div>
          </>
        ) : (
          <>
            <p className="sub">
              {cosmics === 0 ? t('cosmic.unlocksAt', { n: threshold }) : t('cosmic.nextAt', { n: threshold })}
            </p>
            <div className="bar"><div className="bar-fill" style={{ width: pct + '%' }} /></div>
            <div className="mono sub">{t('cosmic.progress', { seals, threshold })}</div>
          </>
        )}
      </div>
      <div className="section-head">
        <h3>{t('cosmic.clauses')}</h3>
        <span className="mono brass">{t('cosmic.points', { n: cosmicPoints })}</span>
      </div>
      {content.clauses.map((c) => <ClauseNode key={c.id} clause={c} />)}
    </section>
  );
}
