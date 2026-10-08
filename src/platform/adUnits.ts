import { Capacitor } from '@capacitor/core';

/**
 * AdMob identifiers. These are public ids (they ship inside the APK); the secret half of
 * the AdMob account never appears here. Source of truth: `docs/store/ids.md`.
 */

export type AdPlacement = 'offline-double' | 'overtime-boost' | 'free-pull' | 'daily-skip' | 'visitor';

export const AD_PLACEMENTS: readonly AdPlacement[] = [
  'offline-double',
  'overtime-boost',
  'free-pull',
  'daily-skip',
  'visitor',
] as const;

/** AdMob app id — also mirrored in `android/app/src/main/AndroidManifest.xml`. */
export const ADMOB_APP_ID = 'ca-app-pub-5130289288594607~4830589570';

/** One rewarded unit per placement so the console reports revenue per placement. */
export const PRODUCTION_REWARDED_UNITS: Record<AdPlacement, string> = {
  'offline-double': 'ca-app-pub-5130289288594607/7233778673',
  'overtime-boost': 'ca-app-pub-5130289288594607/2737586738',
  'free-pull': 'ca-app-pub-5130289288594607/3254618178',
  'daily-skip': 'ca-app-pub-5130289288594607/8562785171',
  visitor: 'ca-app-pub-5130289288594607/6310082380',
};

/** AdMob iOS app id — also in `ios/App/App/Info.plist` (`GADApplicationIdentifier`). */
export const ADMOB_IOS_APP_ID = 'ca-app-pub-5130289288594607~5360698880';

/** The iOS app's own units, same placements and names as Android. */
export const PRODUCTION_REWARDED_UNITS_IOS: Record<AdPlacement, string> = {
  'offline-double': 'ca-app-pub-5130289288594607/6212861531',
  'overtime-boost': 'ca-app-pub-5130289288594607/8414326922',
  'free-pull': 'ca-app-pub-5130289288594607/4899779866',
  'daily-skip': 'ca-app-pub-5130289288594607/3199685383',
  visitor: 'ca-app-pub-5130289288594607/3217840569',
};

/**
 * Google's official rewarded-video test unit. Serving real ads to a development build is
 * an AdMob policy violation, so dev builds always request this one.
 * https://developers.google.com/admob/android/test-ads
 */
export const TEST_REWARDED_UNIT = 'ca-app-pub-3940256099942544/5224354917';
/** iOS counterpart: https://developers.google.com/admob/ios/test-ads */
export const TEST_REWARDED_UNIT_IOS = 'ca-app-pub-3940256099942544/1712485313';

/**
 * True for anything that is not a Vite production build. Vite replaces `import.meta.env.DEV`
 * statically, so a release APK always gets `false`; the fallback only fires in a non-Vite
 * runtime (the `tsx` sim scripts), where erring towards test ads is the safe direction —
 * a live ad request from a non-production build is an AdMob policy violation.
 */
export function isDevBuild(): boolean {
  return import.meta.env?.DEV ?? true;
}

/**
 * Test ads for builds installed on a developer's phone (`npm run cap:sync:test`): those are
 * production bundles, so `isDevBuild()` is false, but tapping a live ad there is still a
 * policy violation. Store releases are built without the flag.
 */
export function useTestAds(): boolean {
  return isDevBuild() || import.meta.env?.VITE_TEST_ADS === '1';
}

export function rewardedUnitId(
  placement: AdPlacement,
  dev: boolean = useTestAds(),
  platform: string = Capacitor.getPlatform(),
): string {
  if (dev) return platform === 'ios' ? TEST_REWARDED_UNIT_IOS : TEST_REWARDED_UNIT;
  return (platform === 'ios' ? PRODUCTION_REWARDED_UNITS_IOS : PRODUCTION_REWARDED_UNITS)[placement];
}
