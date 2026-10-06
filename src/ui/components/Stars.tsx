import { t } from '../../i18n';
import { MAX_STARS } from '../../engine/gacha';

/**
 * Always renders MAX_STARS pips: the first `stars` filled (brass), the rest empty (dimmed).
 * Shared by CardTile and CardSheet so the two star displays never drift apart. An unowned card
 * passes stars=0, which reads as all-empty — dimmed further by CardTile's own `.locked` style.
 */
export function Stars({ stars, className = '' }: { stars: number; className?: string }) {
  const filled = Math.max(0, Math.min(MAX_STARS, stars));
  const empty = MAX_STARS - filled;
  return (
    <span className={`stars mono ${className}`.trim()} aria-label={t('stars.label', { filled, max: MAX_STARS })}>
      <span className="stars-filled">{'★'.repeat(filled)}</span>
      <span className="stars-empty">{'☆'.repeat(empty)}</span>
    </span>
  );
}
