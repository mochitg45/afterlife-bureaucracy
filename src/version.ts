import pkg from '../package.json';

/** The app's release version, read straight from package.json so it never drifts from the build. */
export const APP_VERSION: string = pkg.version;

/** Where the Settings sheet links for the privacy policy. */
export const PRIVACY_URL = 'https://example.invalid/privacy'; // TODO(plan-4): replace before store submission
