import pkg from '../package.json';

/** The app's release version, read straight from package.json so it never drifts from the build. */
export const APP_VERSION: string = pkg.version;

/**
 * Where the Settings sheet links for the privacy policy.
 *
 * Served by GitHub Pages from `docs/privacy.html` on `main`. Enabling Pages is a one-time
 * manual step in the repository settings (Settings → Pages → Deploy from a branch →
 * `main` / `/docs`); see `docs/release.md`. The URL must resolve before the Play
 * Console listing is submitted.
 */
export const PRIVACY_URL = 'https://mochitg45.github.io/afterlife-bureaucracy/privacy.html';
