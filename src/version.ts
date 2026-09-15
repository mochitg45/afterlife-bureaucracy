import pkg from '../package.json';

/** The app's release version, read straight from package.json so it never drifts from the build. */
export const APP_VERSION: string = pkg.version;
