import { useEffect, useState } from 'react';
import { useGame } from '../../store/game';
import { t } from '../../i18n';
import { caseFiles } from '../../data';
import { CASE_VOUCHERS, VERDICTS, caseDay, caseOfDay, caseUnread, sharesOf, type CaseTally, type Verdict } from '../../engine/cases';
import { VoucherIcon } from '../icons/Currency';
import * as haptics from '../../platform/haptics';
import './CaseCard.css';

const PAPERWORK_JOKES = 4;

/**
 * Case of the Day on the Tasks screen: a manila folder with one soul's file. The player rules
 * once (Heaven, Hell or Reincarnate), gets a small fee, and sees how everyone else ruled.
 */
export function CaseCard() {
  const saved = useGame((s) => s.state.cases);
  const info = useGame((s) => s.caseInfo);
  const openCase = useGame((s) => s.openCase);
  const ruleCase = useGame((s) => s.ruleCase);
  const loadTally = useGame((s) => s.loadCaseTally);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [paperwork, setPaperwork] = useState(0);
  // Read once on mount: opening the file clears the unread dot, but this visit still says NEW.
  const [fresh] = useState(() => caseUnread({ cases: saved }, Date.now()));

  const now = Date.now();
  const today = caseDay(now);
  const file = caseOfDay(caseFiles, now);
  const mine = saved.archive.find((e) => e.day === today);
  const ruled = saved.lastDay === today;

  useEffect(() => {
    openCase();
  }, [openCase]);
  useEffect(() => {
    if (ruled) void loadTally();
  }, [ruled, loadTally]);

  const verdictName = (v: Verdict) => t(`case.${v}`);
  const tally: CaseTally | null = info.day === today ? info.tally : null;
  const shares = tally ? sharesOf(tally) : null;
  const top = shares ? VERDICTS.reduce((a, v) => (shares[v] > shares[a] ? v : a)) : null;
  const rule = (v: Verdict) => {
    haptics.heavy();
    void ruleCase(file.id, v);
  };

  return (
    <div className="card case-card" data-testid="case-card">
      <div className="case-tab">
        <span className="case-tab-title">{t('case.title')}</span>
        {fresh && !ruled && <span className="case-new" role="status">{t('case.new')}</span>}
      </div>
      <div className="case-folder">
        <h3 className="case-name">{file.name}</h3>
        <p className="case-story">{file.text}</p>
        <dl className="case-facts">
          <dt>{t('case.cause')}</dt>
          <dd>{file.desc}</dd>
          <dt>{t('case.plea')}</dt>
          <dd className="case-plea">{file.line}</dd>
          <dt>{t('case.note')}</dt>
          <dd>{file.hint}</dd>
        </dl>
        {ruled && mine && (
          <div className="case-stamp" role="img" aria-label={t('case.yourVerdict', { verdict: verdictName(mine.verdict) })}>
            <span className="case-stamp-inner">{verdictName(mine.verdict)}</span>
          </div>
        )}
      </div>

      {!ruled ? (
        <>
          <p className="sub case-reward">
            {t('case.reward', { n: CASE_VOUCHERS })} <VoucherIcon size={14} />
          </p>
          <div className="case-actions">
            {VERDICTS.map((v) => (
              <button key={v} className={`btn case-verdict case-${v}`} disabled={info.busy} onClick={() => rule(v)}>
                {verdictName(v)}
              </button>
            ))}
          </div>
          <div className="case-paperwork">
            {paperwork < PAPERWORK_JOKES ? (
              <button className="btn btn-ghost" onClick={() => setPaperwork((p) => p + 1)}>{t('case.paperwork')}</button>
            ) : (
              <span className="sub">{t('case.paperworkDone')}</span>
            )}
            {paperwork > 0 && paperwork <= PAPERWORK_JOKES && <p className="sub case-joke" role="status">{t(`case.paper${paperwork}`)}</p>}
          </div>
        </>
      ) : (
        <div className="case-results" data-testid="case-results">
          {shares && tally && top ? (
            <>
              <p className="case-headline">{t(`case.majority.${top}`, { pct: shares[top] })}</p>
              {VERDICTS.map((v) => (
                <div key={v} className={'case-share' + (mine?.verdict === v ? ' mine' : '')}>
                  <span className="case-share-label">{verdictName(v)}</span>
                  <div className="bar"><div className="bar-fill" style={{ width: shares[v] + '%' }} /></div>
                  <span className="mono sub">{shares[v]}%</span>
                </div>
              ))}
              <p className="sub">{t('case.total', { n: VERDICTS.reduce((a, v) => a + tally[v], 0).toLocaleString('en-US') })}</p>
            </>
          ) : (
            <p className="sub">{t('case.noResults')}</p>
          )}
          <p className="sub">{t('case.comeBack')}</p>
        </div>
      )}

      <div className="case-archive-head">
        <button className="btn btn-ghost" aria-expanded={archiveOpen} onClick={() => setArchiveOpen((o) => !o)}>
          {archiveOpen ? t('case.archiveHide') : t('case.archiveShow', { n: saved.archive.length })}
        </button>
      </div>
      {archiveOpen && (
        <ul className="case-archive" aria-label={t('case.archive')}>
          {saved.archive.length === 0 && <li className="sub">{t('case.archiveEmpty')}</li>}
          {[...saved.archive].reverse().map((e) => (
            <li key={e.day}>
              <span className="mono sub">{e.day}</span>
              <strong>{caseFiles.find((c) => c.id === e.caseId)?.name ?? e.caseId}</strong>
              <span className="sub">
                {t('case.archiveMine', { verdict: verdictName(e.verdict) })} · {e.majority ? t('case.archiveMajority', { verdict: verdictName(e.majority) }) : t('case.archiveUnknown')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
