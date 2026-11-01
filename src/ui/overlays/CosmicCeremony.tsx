import type { CSSProperties } from 'react';
import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { cosmicThreshold } from '../../engine/cosmic';
import { Modal } from '../components/Modal';
import { CountUp } from '../components/CountUp';
import './Ceremony.css';

const SEAL = (
  <svg viewBox="0 0 200 110" width="200" height="110" className="slam cosmic-seal" aria-hidden="true">
    <circle cx="100" cy="55" r="42" fill="none" stroke="var(--brass)" strokeWidth="5" />
    <circle cx="100" cy="55" r="32" fill="none" stroke="var(--brass)" strokeWidth="2" />
    <text x="100" y="68" textAnchor="middle" fill="var(--brass)" fontFamily="var(--font-display)" fontSize="30">✦</text>
  </svg>
);

/** The Cosmic Restructuring ceremony. No onClose: the one button is the acknowledgement. */
export function CosmicCeremony() {
  const last = useGame((s) => s.lastCosmic);
  // The bar the next filing has to clear, which is not the one this filing cleared: say so
  // here rather than letting the player rediscover it on the Ledger.
  const cosmics = useGame((s) => s.state.stats.cosmics);
  const dismiss = useGame((s) => s.dismissCosmic);
  if (!last) return null;
  const art = { '--cer-bg': `url(${import.meta.env.BASE_URL}art/ui/cosmic-bg.webp)` } as CSSProperties;
  const header = (
    <>
      <div className="twinkle" aria-hidden="true" />
      {SEAL}
    </>
  );
  return (
    <Modal open title={t('cosmicCer.title')} label={t('cosmicCer.label')} header={header} backdropClassName="ceremony cosmic-ceremony" backdropStyle={art}>
      <div className="mono value brass cer-count"><CountUp to={last.pointsGained} render={(n) => t('cosmicCer.points', { n: String(n) })} /></div>
      <p className="sub">
        {t('cosmicCer.sub')}
      </p>
      <p className="sub">{t('cosmicCer.next', { n: String(cosmicThreshold(cosmics)) })}</p>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={dismiss}>{t('cosmicCer.back')}</button>
      </div>
    </Modal>
  );
}
