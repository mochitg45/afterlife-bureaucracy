/**
 * AdMob identifiers. These are public ids (they ship inside the APK); the secret half of
 * the AdMob account never appears here. Source of truth: `docs/store/ids.md`.
 */

export type AdPlacement = 'offline-double' | 'overtime-boost' | 'free-pull' | 'daily-skip';

export const AD_PLACEMENTS: readonly AdPlacement[] = [
  'offline-double',
  'overtime-boost',
  'free-pull',
  'daily-skip',
] as const;

/** AdMob app id — also mirrored in `android/app/src/main/AndroidManifest.xml`. */
export const ADMOB_APP_ID = 'ca-app-pub-5130289288594607~4830589570';

/** One rewarded unit per placement so the console reports revenue per placement. */
export const PRODUCTION_REWARDED_UNITS: Record<AdPlacement, string> = {
  'offline-double': 'ca-app-pub-5130289288594607/7233778673',
  'overtime-boost': 'ca-app-pub-5130289288594607/2737586738',
  'free-pull': 'ca-app-pub-5130289288594607/3254618178',
  'daily-skip': 'ca-app-pub-5130289288594607/8562785171',
};

/**
 * Google's official rewarded-video test unit. Serving real ads to a development build is
 * an AdMob policy violation, so dev builds always request this one.
 * https://developers.google.com/admob/android/test-ads
 */
export const TEST_REWARDED_UNIT = 'ca-app-pub-3940256099942544/5224354917';

/**
 * True for anything that is not a Vite production build. Vite replaces `import.meta.env.DEV`
 * statically, so a release APK always gets `false`; the fallback only fires in a non-Vite
 * runtime (the `tsx` sim scripts), where erring towards test ads is the safe direction —
 * a live ad request from a non-production build is an AdMob policy violation.
 */
export function isDevBuild(): boolean {
  return import.meta.env?.DEV ?? true;
}

export function rewardedUnitId(placement: AdPlacement, dev: boolean = isDevBuild()): string {
  return dev ? TEST_REWARDED_UNIT : PRODUCTION_REWARDED_UNITS[placement];
}
