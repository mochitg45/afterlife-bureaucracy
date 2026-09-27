/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** RevenueCat public iOS SDK key (an `appl_…` string), injected at build time. */
  readonly VITE_REVENUECAT_IOS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
