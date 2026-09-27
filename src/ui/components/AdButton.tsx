import { useGame } from '../../store/game';
import { useWatchAd } from '../hooks/useWatchAd';
import { adsSupported, type AdPlacement } from '../../platform/ads';

/**
 * A rewarded-ad button. `canWatch` is selected rather than derived so the button re-evaluates
 * whenever the placement's gate moves — the ad SDK loading, a daily placement being spent, a
 * cooldown expiring — and re-renders only when the answer actually changes.
 *
 * When the SDK has nothing to show, the button stays visible but disabled and says so: a
 * reward that silently disappears reads as a bug.
 */
export function AdButton({
  placement,
  label,
  text,
  taskId,
  primary,
}: {
  placement: AdPlacement;
  /** Accessible name; also the button's text unless `text` narrows it. */
  label: string;
  text?: string;
  taskId?: string;
  primary?: boolean;
}) {
  const ready = useGame((s) => s.canWatch(placement));
  const adsReady = useGame((s) => s.adsReady);
  const { busy, watch } = useWatchAd(placement, taskId);
  // No ad network on iOS: hide the placement entirely rather than show a permanently
  // disabled "Ad not available" button.
  if (!adsSupported()) return null;
  return (
    <span className="ad-button">
      <button
        className={'btn' + (primary ? ' btn-primary' : '')}
        disabled={!ready || busy}
        aria-label={label}
        onClick={watch}
      >
        {text ?? label}
      </button>
      {!adsReady && <span className="sub warn">Ad not available</span>}
    </span>
  );
}
