import type { CSSProperties } from 'react';
import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { Modal } from '../components/Modal';
import { Gavel } from '../components/Gavel';
import { CountUp } from '../components/CountUp';
import './Ceremony.css';

const STAMP = (
  <svg viewBox="0 0 200 110" width="170" height="94" className="slam audit-stamp" aria-hidden="true">
    <rect x="6" y="18" width="188" height="74" rx="8" fill="none" stroke="var(--red)" strokeWidth="5" transform="rotate(-6 100 55)" />
    <text x="100" y="66" textAnchor="middle" fill="var(--red)" fontFamily="var(--font-display)" fontSize="34" transform="rotate(-6 100 55)">{t('audit.stamp')}</text>
  </svg>
);

const COLORS = ['#E8C164', '#A6402B', '#3E9C93', '#F7F2E4', '#6B6478'];
/** Paper confetti: fixed pseudo-random spread so a re-render never reshuffles it. */
const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: ((i * 53) % 18) / 10,
  dur: 3 + ((i * 29) % 20) / 10,
  color: COLORS[i % COLORS.length],
  rot: (i * 47) % 360,
}));

export function AuditCeremony() {
  const last = useGame((s) => s.lastAudit);
  const dismiss = useGame((s) => s.dismissAudit);
  if (!last) return null;
  const art = { '--cer-bg': `url(${import.meta.env.BASE_URL}art/ui/audit-bg.webp)` } as CSSProperties;
  const header = (
    <>
      <div className="confetti" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <i key={i} style={{ left: `${c.left}%`, animationDelay: `${c.delay + 0.5}s`, animationDuration: `${c.dur}s`, background: c.color, transform: `rotate(${c.rot}deg)` }} />
        ))}
      </div>
      <div className="gavel-stage" aria-hidden="true">
        <Gavel size={84} className="gavel-hit" />
        <div className="impact" />
      </div>
      {STAMP}
      <div className="cer-plaque">{t('ledger.fiscalYear')} {Math.max(1, last.fiscalYear - 1)}</div>
    </>
  );
  // No onClose: the books are closed, and the one button says so.
  return (
    <Modal open title={t('audit.title')} label={t('audit.label')} header={header} backdropClassName="ceremony audit-ceremony" backdropStyle={art}>
      <div className="mono value brass cer-count"><CountUp to={last.sealsGained} render={(n) => t('audit.seals', { n: String(n) })} /></div>
      <p className="sub">{t('audit.sub', { year: String(last.fiscalYear) })}</p>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={dismiss}>{t('audit.back')}</button>
      </div>
    </Modal>
  );
}
