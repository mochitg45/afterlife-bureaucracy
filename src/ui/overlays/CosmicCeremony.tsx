import { useGame } from '../../store/game';
import { Modal } from '../components/Modal';

const SEAL = (
  <svg viewBox="0 0 200 110" width="200" height="110" className="slam" aria-hidden="true">
    <circle cx="100" cy="55" r="42" fill="none" stroke="var(--brass)" strokeWidth="5" />
    <circle cx="100" cy="55" r="32" fill="none" stroke="var(--brass)" strokeWidth="2" />
    <text x="100" y="68" textAnchor="middle" fill="var(--brass)" fontFamily="var(--font-display)" fontSize="30">✦</text>
  </svg>
);

/** The Cosmic Restructuring ceremony. No onClose: the one button is the acknowledgement. */
export function CosmicCeremony() {
  const last = useGame((s) => s.lastCosmic);
  const dismiss = useGame((s) => s.dismissCosmic);
  if (!last) return null;
  return (
    <Modal open title="The Bureau has been restructured." label="Cosmic Restructuring" header={SEAL} backdropClassName="ceremony">
      <div className="mono value brass">+{last.pointsGained} Clause point</div>
      <p className="sub">Your Seals and Perks have been returned to the Bureau. The paperwork survives. It always does.</p>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={dismiss}>Back to the office</button>
      </div>
    </Modal>
  );
}
