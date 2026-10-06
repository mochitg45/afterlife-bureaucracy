import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { Modal } from '../components/Modal';

const STAMP = (
  <svg viewBox="0 0 200 110" width="200" height="110" className="slam" aria-hidden="true">
    <rect x="6" y="18" width="188" height="74" rx="8" fill="none" stroke="var(--red)" strokeWidth="5" transform="rotate(-6 100 55)" />
    <text x="100" y="66" textAnchor="middle" fill="var(--red)" fontFamily="var(--font-display)" fontSize="34" transform="rotate(-6 100 55)">{t('audit.stamp')}</text>
  </svg>
);

export function AuditCeremony() {
  const last = useGame((s) => s.lastAudit);
  const dismiss = useGame((s) => s.dismissAudit);
  if (!last) return null;
  // No onClose: the books are closed, and the one button says so.
  return (
    <Modal open title={t('audit.title')} label={t('audit.label')} header={STAMP} backdropClassName="ceremony">
      <div className="mono value brass">{t('audit.seals', { n: String(last.sealsGained) })}</div>
      <p className="sub">{t('audit.sub', { year: String(last.fiscalYear) })}</p>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={dismiss}>{t('audit.back')}</button>
      </div>
    </Modal>
  );
}
