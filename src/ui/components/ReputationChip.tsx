import { useState } from 'react';
import { useGame, TRAINING_DONE } from '../../store/game';
import { ReviewStars as Stars } from './ReviewStars';
import { ReviewsSheet } from '../overlays/ReviewsSheet';
import { t } from '../../i18n';
import '../overlays/ReviewsSheet.css';

/** Small star-rating chip; tapping it opens the Reviews sheet. Hidden until the tutorial is done. */
export function ReputationChip() {
  const trained = useGame((s) => s.state.onboarding.trainingStep >= TRAINING_DONE);
  const score = useGame((s) => s.state.reputation.score);
  const [open, setOpen] = useState(false);
  if (!trained) return null;
  const shown = score.toFixed(1);
  return (
    <>
      <button type="button" className="btn rep-chip" aria-label={t('reviews.chipAria', { score: shown })} onClick={() => setOpen(true)}>
        <Stars value={score} size={14} />
        <span className="rep-num mono">{shown}</span>
      </button>
      {open && <ReviewsSheet onClose={() => setOpen(false)} />}
    </>
  );
}
