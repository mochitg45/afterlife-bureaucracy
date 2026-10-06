import { FirebaseAppCheck } from '@capacitor-firebase/app-check';
import { firebaseConfig, firebaseConfigured } from './firebaseConfig';
import type { Firestore } from 'firebase/firestore';

/** A signed-in (anonymous) Firestore handle, App Check attached. */
export interface Backend {
  db: Firestore;
  uid: string;
}

let backend: Promise<Backend> | null = null;

/**
 * The Firebase JS SDK, initialised once and lazily: nothing here loads until the referral card
 * or the boot check first asks, so a player who never touches invites never pays for it.
 *
 * App Check comes first, before Auth or Firestore make a request. The JS SDK has no Play
 * Integrity provider of its own, so a CustomProvider hands it the token the native
 * `@capacitor-firebase/app-check` plugin mints (Play Integrity on Android).
 *
 * A failed init is forgotten, so a later call (back online, Play services updated) tries again.
 */
export function getBackend(): Promise<Backend> {
  backend ??= init().catch((e) => {
    backend = null;
    throw e;
  });
  return backend;
}

async function init(): Promise<Backend> {
  if (!firebaseConfigured()) throw new Error('firebase web config not filled in');
  const [{ initializeApp, getApps }, { initializeAppCheck, CustomProvider }, { getAuth, signInAnonymously }, { getFirestore }] =
    await Promise.all([import('firebase/app'), import('firebase/app-check'), import('firebase/auth'), import('firebase/firestore')]);

  await FirebaseAppCheck.initialize({ isTokenAutoRefreshEnabled: true });
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  initializeAppCheck(app, {
    provider: new CustomProvider({
      async getToken() {
        const r = await FirebaseAppCheck.getToken({ forceRefresh: false });
        // The native SDK reports the expiry; fall back to its usual hour if it does not.
        return { token: r.token, expireTimeMillis: r.expireTimeMillis ?? Date.now() + 55 * 60_000 };
      },
    }),
    isTokenAutoRefreshEnabled: true,
  });

  const auth = getAuth(app);
  await auth.authStateReady(); // restores the stored anonymous user, so the uid survives launches
  const uid =auth.currentUser?.uid ?? (await signInAnonymously(auth)).user.uid;
  return { db: getFirestore(app), uid };
}
