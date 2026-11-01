import { useEffect, useState } from 'react';
import { useGame } from '../../store/game';
import { t } from '../../i18n';
import { caseFiles } from '../../data';
import { CASE_VOUCHERS, VERDICTS, caseDay, caseOfDay, caseUnread, sharesOf, type CaseTally, type Verdict } from '../../engine/cases';
import { VoucherIcon } from '../icons/Currency';
import * as haptics from '../../platform/haptics';
import './CaseCard.css';

const PAPERWORK_JOKES = 4;
const art = (n: string) => `${import.meta.env.BASE_URL}art/ui/${n}.webp`;
const HAIR = ['#3b2a20', '#8a5a2b', '#1f1f28', '#b5651d', '#6b6478', '#a6402b'];
const SHIRT = ['#3E9C93', '#A8823C', '#6B6478', '#1F3B33', '#A6402B'];

/** A little chibi silhouette for the photo slot; hair and shirt are picked from the case id. */
function Chibi({ seed }: { seed: string }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <svg className="case-chibi" viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="32" cy="9" rx="9" ry="3" fill="none" stroke="var(--brass)" strokeWidth="2" />
      <path d="M12 64 C12 46 20 42 32 42 C44 42 52 46 52 64 Z" fill={SHIRT[h % SHIRT.length]} stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="32" cy="27" r="15" fill="#f2cfae" stroke="var(--ink)" strokeWidth="2.5" />
      <path d="M17 26 C16 12 48 10 47 26 C42 20 24 20 17 26 Z" fill={HAIR[(h >> 3) % HAIR.length]} stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="26" cy="30" r="1.8" fill="var(--ink)" />
      <circle cx="38" cy="30" r="1.8" fill="var(--ink)" />
      <path d="M28 35 Q32 38 36 35" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

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
  const [slammed, setSlammed] = useState(false);
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
    setSlammed(true);
    void ruleCase(file.id, v);
  };

  return (
    <div className="card case-card" data-testid="case-card">
      <div className="case-tab">
        <span className="case-tab-title">{t('case.title')}</span>
        {fresh && !ruled && <span className="case-new" role="status">{t('case.new')}</span>}
      </div>
      <div className={'case-folder' + (slammed && ruled ? ' thud' : '')} style={{ backgroundImage: `url(${art('case-folder')})` }}>
        <div className="case-photo"><Chibi seed={file.id} /></div>
        <h3 className="case-name">{file.name}</h3>
        {ruled && mine && (
          <div className="case-stamp" role="img" aria-label={t('case.yourVerdict', { verdict: verdictName(mine.verdict) })}>
            <img src={art(`stamp-${mine.verdict}`)} alt="" draggable={false} />
          </div>
        )}
        <div className="case-page" tabIndex={0} role="region" aria-label={file.name}>
          <p className="case-story">{file.text}</p>
          <dl className="case-facts">
            <dt>{t('case.cause')}</dt>
            <dd>{file.desc}</dd>
            <dt>{t('case.plea')}</dt>
            <dd className="case-plea">{file.line}</dd>
            <dt>{t('case.note')}</dt>
            <dd>{file.hint}</dd>
          </dl>
        </div>
      </div>

      {!ruled ? (
        <>
          <p className="sub case-reward">
            {t('case.reward', { n: CASE_VOUCHERS })} <VoucherIcon size={14} />
          </p>
          <div className="case-actions">
            {VERDICTS.map((v) => (
              <button key={v} className={`btn case-verdict case-${v}`} disabled={info.busy} onClick={() => rule(v)}>
                <span className="case-pad"><img src={art(`stamp-${v}`)} alt="" draggable={false} /></span>
                <span className="case-verdict-label">{verdictName(v)}</span>
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
                  <div className={`case-ink case-ink-${v}`}><i style={{ width: shares[v] + '%' }} /></div>
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
