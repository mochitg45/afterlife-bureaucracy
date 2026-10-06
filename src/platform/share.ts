import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { t } from '../i18n';

/** The invitation picture shipped in the web bundle (public/art/share/invite.png). */
export const INVITE_IMAGE = 'art/share/invite.png';

/** The invitation text, in the language the page loaded with. */
export const INVITE_PITCH = t('share.pitch');

export interface Sharer {
  /**
   * Opens the system share sheet with the invitation image (when it can be attached) and
   * `text`. True when the sheet resolved, false when it was cancelled, failed or does not
   * exist here. Never throws.
   */
  share(text: string): Promise<boolean>;
}

/** Copies the bundled picture into the cache dir, where the share sheet can read it as a file. */
async function imageFile(): Promise<string | null> {
  try {
    const blob = await (await fetch(INVITE_IMAGE)).blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const { uri } = await Filesystem.writeFile({ path: 'invite.png', data, directory: Directory.Cache });
    return uri;
  } catch {
    return null; // text-only share is still a share
  }
}

export const systemSharer: Sharer = {
  async share(text) {
    try {
      if (Capacitor.isNativePlatform()) {
        const file = await imageFile();
        await Share.share({ title: 'Afterlife Bureaucracy', text, dialogTitle: t('share.dialogTitle'), ...(file ? { files: [file] } : {}) });
        return true;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'Afterlife Bureaucracy', text });
        return true;
      }
      return false;
    } catch {
      return false; // cancelled (the plugin rejects) or no share target
    }
  },
};

/** Tests: resolves with `result`, remembers what it was asked to share. */
export function memorySharer(result = true): Sharer & { shared: string[] } {
  const fake = {
    shared: [] as string[],
    async share(text: string) {
      fake.shared.push(text);
      return result;
    },
  };
  return fake;
}

export function pickSharer(): Sharer {
  return systemSharer;
}
