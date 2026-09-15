import { useGame } from '../../store/game';
import { Modal } from '../components/Modal';

const STAMP = (
  <svg viewBox="0 0 200 110" width="200" height="110" className="slam" aria-hidden="true">
    <rect x="6" y="18" width="188" height="74" rx="8" fill="none" stroke="var(--red)" strokeWidth="5" transform="rotate(-6 100 55)" />
    <text x="100" y="66" textAnchor="middle" fill="var(--red)" fontFamily="var(--font-display)" fontSize="34" transform="rotate(-6 100 55)">APPROVED</text>
  </svg>
);

export function AuditCeremony() {
  const last = useGame((s) => s.lastAudit);
  const dismiss = useGame((s) => s.dismissAudit);
  if (!last) return null;
  // No onClose: the books are closed, and the one button says so.
  return (
    <Modal open title="Books closed." label="Fiscal Year Audit" header={STAMP} backdropClassName="ceremony">
      <div className="mono value brass">+{last.sealsGained} Karma Seals</div>
      <p className="sub">Fiscal Year {last.fiscalYear} begins. The backlog is fresh. The memos are not.</p>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={dismiss}>Back to the office</button>
      </div>
    </Modal>
  );
}
