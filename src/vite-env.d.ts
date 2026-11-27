/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' in phone test builds (`--mode testads`): AdMob serves test ads. */
  readonly VITE_TEST_ADS?: string;
  /** Phone test builds: open every feature on boot (engine/testUnlocks.ts). */
  readonly VITE_TEST_UNLOCKS?: string;
  /** RevenueCat public iOS SDK key (an `appl_…` string), injected at build time. */
  readonly VITE_REVENUECAT_IOS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
