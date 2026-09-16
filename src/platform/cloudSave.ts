import { Capacitor, registerPlugin } from '@capacitor/core';

export type SignInResult = 'ok' | 'cancelled' | 'unavailable';

/** One cloud slot: the serialised save plus the wall clock it was written at. */
export interface CloudSnapshot {
  data: string;
  savedAtWall: number;
}

export interface CloudSave {
  /** False on web and iOS today; cloud save is a Play Games feature. */
  available(): boolean;
  isSignedIn(): Promise<boolean>;
  signIn(): Promise<SignInResult>;
  /** `null` when the player has no snapshot yet, or when the slot could not be read. */
  load(): Promise<CloudSnapshot | null>;
  save(snapshot: CloudSnapshot, description: string): Promise<'ok' | 'error'>;
}

/**
 * The single Play Games snapshot slot the game uses. One slot, overwritten every sync: the
 * game has one save, so a second slot could only ever be a second way to lose it.
 */
export const SNAPSHOT_NAME = 'afterlife-main';

/** The in-repo Android plugin, `android/app/src/main/java/.../CloudSavePlugin.java`. */
interface CloudSaveNativePlugin {
  isAuthenticated(): Promise<{ value: boolean }>;
  signIn(): Promise<{ value: boolean }>;
  loadSnapshot(options: { name: string }): Promise<{ found: boolean; data?: string; savedAtWall?: number }>;
  saveSnapshot(options: { name: string; data: string; description: string; savedAtWall: number }): Promise<void>;
}

const CloudSaveNative = registerPlugin<CloudSaveNativePlugin>('CloudSave');

/**
 * In-memory fake for tests and the simulator. Load and save are gated on being signed in,
 * exactly as the real thing is, so a caller that forgets to sign in fails here too rather
 * than only on a device. `snapshot` and `signedIn` are writable for tests that want to set
 * the world up without going through `signIn()`.
 */
export function memoryCloudSave(
  opts: { available?: boolean; signedIn?: boolean; snapshot?: CloudSnapshot | null; failSave?: boolean } = {},
): CloudSave & { snapshot: CloudSnapshot | null; signedIn: boolean } {
  const available = opts.available ?? true;
  const failSave = opts.failSave ?? false;

  const fake = {
    snapshot: opts.snapshot ?? null,
    signedIn: (opts.signedIn ?? false) && available,

    available() {
      return available;
    },

    async isSignedIn() {
      return available && fake.signedIn;
    },

    async signIn(): Promise<SignInResult> {
      if (!available) return 'unavailable';
      fake.signedIn = true;
      return 'ok';
    },

    async load(): Promise<CloudSnapshot | null> {
      if (!available || !fake.signedIn) return null;
      return fake.snapshot;
    },

    async save(snapshot: CloudSnapshot): Promise<'ok' | 'error'> {
      if (!available || !fake.signedIn || failSave) return 'error';
      fake.snapshot = snapshot;
      return 'ok';
    },
  };

  return fake;
}

/** Web and iOS: there is no cloud slot, so nothing signs in and nothing round-trips. */
export const noopCloudSave: CloudSave = {
  available() {
    return false;
  },
  async isSignedIn() {
    return false;
  },
  async signIn() {
    return 'unavailable';
  },
  async load() {
    return null;
  },
  async save() {
    return 'error';
  },
};

/**
 * Play Games Services snapshots, through the in-repo `CloudSave` Capacitor plugin.
 *
 * Every plugin call is wrapped: cloud save is a convenience layered over the local save, so a
 * signed-out player, a device without Play Games, a missing Play Games app id or an offline
 * network must resolve to a result union rather than throw. A caller never has to wrap a
 * cloud call in a try/catch, and a broken cloud can never break a local save.
 *
 * Sign-in is shared with `gameServices.ts`: both sit on the same `GamesSignInClient`, so
 * signing in for achievements also signs in for cloud save and vice versa.
 */
export const playCloudSave: CloudSave = {
  available() {
    try {
      return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    } catch {
      return false;
    }
  },

  async isSignedIn() {
    try {
      const r = await CloudSaveNative.isAuthenticated();
      return r?.value === true;
    } catch {
      return false;
    }
  },

  async signIn() {
    try {
      const r = await CloudSaveNative.signIn();
      // The interactive prompt resolves with `false` when the player backs out of it.
      return r?.value === true ? 'ok' : 'cancelled';
    } catch {
      return 'unavailable'; // no plugin, no Play Games app id, or no Play services
    }
  },

  async load() {
    try {
      const r = await CloudSaveNative.loadSnapshot({ name: SNAPSHOT_NAME });
      if (!r || r.found !== true || typeof r.data !== 'string') return null;
      const savedAtWall = typeof r.savedAtWall === 'number' && Number.isFinite(r.savedAtWall) ? r.savedAtWall : 0;
      return { data: r.data, savedAtWall };
    } catch {
      return null; // treated as "no snapshot": the local save stands
    }
  },

  async save(snapshot, description) {
    try {
      await CloudSaveNative.saveSnapshot({
        name: SNAPSHOT_NAME,
        data: snapshot.data,
        description,
        savedAtWall: snapshot.savedAtWall,
      });
      return 'ok';
    } catch {
      return 'error';
    }
  },
};

export function pickCloudSave(): CloudSave {
  return playCloudSave.available() ? playCloudSave : noopCloudSave;
}
