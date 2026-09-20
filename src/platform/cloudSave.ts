import { Capacitor, registerPlugin } from '@capacitor/core';

export type SignInResult = 'ok' | 'cancelled' | 'unavailable';

/** One cloud slot: the serialised save plus the wall clock it was written at. */
export interface CloudSnapshot {
  data: string;
  savedAtWall: number;
}

/**
 * What reading the slot came back with. An empty slot and a slot that could not be read are
 * different answers on purpose: the first invites an upload, the second must never provoke
 * one -- a network blip is not a reason to write a fresh save over a player's real run.
 */
export type CloudLoad =
  | { status: 'found'; snapshot: CloudSnapshot }
  | { status: 'empty' }
  | { status: 'error' };

export interface CloudSave {
  /** False on web and iOS today; cloud save is a Play Games feature. */
  available(): boolean;
  /**
   * Whether this build actually has a cloud slot. `available()` is a platform probe and
   * cannot see whether the Play Games app id was ever put in the manifest, so the store
   * resolves this once at boot and the UI reads that answer instead.
   */
  isConfigured(): Promise<boolean>;
  isSignedIn(): Promise<boolean>;
  signIn(): Promise<SignInResult>;
  load(): Promise<CloudLoad>;
  save(snapshot: CloudSnapshot, description: string): Promise<'ok' | 'error'>;
}

/**
 * The single Play Games snapshot slot the game uses. One slot, overwritten every sync: the
 * game has one save, so a second slot could only ever be a second way to lose it.
 */
export const SNAPSHOT_NAME = 'afterlife-main';

/** The in-repo Android plugin, `android/app/src/main/java/.../CloudSavePlugin.java`. */
interface CloudSaveNativePlugin {
  isConfigured(): Promise<{ value: boolean }>;
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
  opts: {
    available?: boolean;
    signedIn?: boolean;
    snapshot?: CloudSnapshot | null;
    failSave?: boolean;
    /** Every read comes back as an unreadable slot, as a network blip would. */
    failLoad?: boolean;
  } = {},
): CloudSave & { snapshot: CloudSnapshot | null; signedIn: boolean } {
  const available = opts.available ?? true;
  const failSave = opts.failSave ?? false;
  const failLoad = opts.failLoad ?? false;

  const fake = {
    snapshot: opts.snapshot ?? null,
    signedIn: (opts.signedIn ?? false) && available,

    available() {
      return available;
    },

    async isConfigured() {
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

    async load(): Promise<CloudLoad> {
      if (!available || !fake.signedIn || failLoad) return { status: 'error' };
      return fake.snapshot ? { status: 'found', snapshot: fake.snapshot } : { status: 'empty' };
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
  async isConfigured() {
    return false;
  },
  async isSignedIn() {
    return false;
  },
  async signIn() {
    return 'unavailable';
  },
  async load(): Promise<CloudLoad> {
    // Nothing can ever be signed in here, so a caller is refused long before this; an empty
    // slot is the honest answer for a platform that has no slot to fail at reading.
    return { status: 'empty' };
  },
  async save() {
    return 'error';
  },
};

/**
 * How long a snapshot call may hang before it is treated as a failure. A Play Games call
 * that never settles would leave the store's `syncing` flag on for the rest of the session,
 * so every non-interactive call resolves one way or the other within this.
 */
export const CLOUD_TIMEOUT_MS = 15_000;

// ponytail: the loser's timer is left to fire rather than cleared -- a 15 s no-op per cloud
// call. Clear it with a handle if a profiler ever shows the timers mattering.
function withTimeout<T>(p: Promise<T>, onTimeout: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(onTimeout), CLOUD_TIMEOUT_MS))]);
}

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

  async isConfigured() {
    try {
      const r = await withTimeout(CloudSaveNative.isConfigured(), { value: false });
      return r?.value === true;
    } catch {
      return false; // an older build of the plugin, or none at all
    }
  },

  async isSignedIn() {
    try {
      const r = await withTimeout(CloudSaveNative.isAuthenticated(), { value: false });
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

  async load(): Promise<CloudLoad> {
    try {
      const r = await withTimeout<Awaited<ReturnType<CloudSaveNativePlugin['loadSnapshot']>> | null>(
        CloudSaveNative.loadSnapshot({ name: SNAPSHOT_NAME }),
        null,
      );
      if (!r) return { status: 'error' };
      if (r.found !== true) return { status: 'empty' };
      // Found, but the payload did not come back as a string: the slot holds something this
      // read could not see, which is an error, never an empty slot to write over.
      if (typeof r.data !== 'string') return { status: 'error' };
      const savedAtWall = typeof r.savedAtWall === 'number' && Number.isFinite(r.savedAtWall) ? r.savedAtWall : 0;
      return { status: 'found', snapshot: { data: r.data, savedAtWall } };
    } catch {
      // A failed read is not an empty slot: the caller must keep the local save and try
      // again later, never overwrite a cloud copy it could not see.
      return { status: 'error' };
    }
  },

  async save(snapshot, description) {
    try {
      return await withTimeout(
        CloudSaveNative.saveSnapshot({
          name: SNAPSHOT_NAME,
          data: snapshot.data,
          description,
          savedAtWall: snapshot.savedAtWall,
        }).then((): 'ok' | 'error' => 'ok'),
        'error',
      );
    } catch {
      return 'error';
    }
  },
};

export function pickCloudSave(): CloudSave {
  return playCloudSave.available() ? playCloudSave : noopCloudSave;
}
