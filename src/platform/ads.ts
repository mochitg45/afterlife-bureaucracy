import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus, RewardAdPluginEvents } from '@capacitor-community/admob';
import type { AdMobRewardItem } from '@capacitor-community/admob';
import { isDevBuild, rewardedUnitId } from './adUnits';
import type { AdPlacement } from './adUnits';

export type { AdPlacement };
export { AD_PLACEMENTS } from './adUnits';

export type AdResult = 'rewarded' | 'dismissed' | 'unavailable';

export interface Ads {
  init(): Promise<void>;
  isReady(): boolean;
  showRewarded(placement: AdPlacement): Promise<AdResult>;
}

/** How long the web mock pretends to play an ad for. */
export const WEB_AD_DURATION_MS = 300;

/** Browser and test fallback: no SDK, always rewards after a short pretend playback. */
export const webAds: Ads = {
  async init() {},
  isReady() {
    return true;
  },
  showRewarded() {
    return new Promise<AdResult>((resolve) => {
      setTimeout(() => resolve('rewarded'), WEB_AD_DURATION_MS);
    });
  },
};

/**
 * AdMob rewarded video. Every SDK call is guarded: a plugin or network failure resolves
 * `'unavailable'` rather than throwing, so the caller never has to wrap an ad in a try/catch
 * and a broken ad network can never break a game action.
 *
 * Not exercised by tests — there is no AdMob SDK under jsdom. Typed against the plugin's
 * published definitions and covered by `tsc` only.
 */
export const admobAds: Ads = (() => {
  let initialised = false;

  async function requestConsent(): Promise<void> {
    // UMP: required for EEA/UK users before any ad request. A failure here is not fatal —
    // AdMob serves non-personalised ads when consent could not be gathered.
    try {
      const info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
        await AdMob.showConsentForm();
      }
    } catch {
      /* consent unavailable; continue with non-personalised ads */
    }
  }

  return {
    async init() {
      await requestConsent();
      try {
        await AdMob.initialize({ initializeForTesting: isDevBuild() });
        initialised = true;
      } catch {
        initialised = false;
      }
    },

    isReady() {
      return initialised;
    },

    async showRewarded(placement) {
      if (!initialised) return 'unavailable';

      try {
        await AdMob.prepareRewardVideoAd({ adId: rewardedUnitId(placement), isTesting: isDevBuild() });
      } catch {
        return 'unavailable'; // no fill, offline, or a bad unit id
      }

      let rewarded = false;
      let handle: { remove: () => Promise<void> } | undefined;
      try {
        handle = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
          rewarded = true;
        });
      } catch {
        /* no listener: fall back to the resolved reward item below */
      }

      try {
        const item: AdMobRewardItem | undefined = await AdMob.showRewardVideoAd();
        if (item && typeof item.amount === 'number' && item.amount > 0) rewarded = true;
        return rewarded ? 'rewarded' : 'dismissed';
      } catch {
        // Failed to show. If the reward already fired, honour it.
        return rewarded ? 'rewarded' : 'unavailable';
      } finally {
        try {
          await handle?.remove();
        } catch {
          /* already gone */
        }
      }
    },
  };
})();

export function pickAds(): Ads {
  return Capacitor.isNativePlatform() ? admobAds : webAds;
}
