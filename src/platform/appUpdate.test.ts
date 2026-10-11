import { AppUpdateAvailability } from '@capawesome/capacitor-app-update';
import { updateRequired, checkUpdate } from './appUpdate';

describe('forced update', () => {
  it('requires an update only when Play has a newer version (or one is installing)', () => {
    expect(updateRequired({ updateAvailability: AppUpdateAvailability.UPDATE_AVAILABLE })).toBe(true);
    expect(updateRequired({ updateAvailability: AppUpdateAvailability.UPDATE_IN_PROGRESS })).toBe(true);
    expect(updateRequired({ updateAvailability: AppUpdateAvailability.UPDATE_NOT_AVAILABLE })).toBe(false);
    expect(updateRequired({ updateAvailability: AppUpdateAvailability.UNKNOWN })).toBe(false);
  });
  it('never blocks off Android (web, iOS, tests)', async () => {
    expect(await checkUpdate()).toBe(false);
  });
});
