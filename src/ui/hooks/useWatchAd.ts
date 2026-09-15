import { useCallback, useRef, useState } from 'react';
import { useGame } from '../../store/game';
import type { AdPlacement } from '../../platform/ads';

/**
 * Starts one rewarded ad at a time.
 *
 * Every placement's gate lives in state the store only writes *after* the ad resolves —
 * `pendingOffline`, `adState.freePullDate`, the boost cooldown — so two taps inside the same
 * ad would both pass `canWatch` and both pay out. The ref closes the door on the first tap,
 * before React has re-rendered anything.
 */
export function useWatchAd(placement: AdPlacement, taskId?: string): { busy: boolean; watch: () => void } {
  const watchAd = useGame((s) => s.watchAd);
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const watch = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    void watchAd(placement, taskId).finally(() => {
      running.current = false;
      setBusy(false);
    });
  }, [watchAd, placement, taskId]);
  return { busy, watch };
}
