/**
 * Firebase *web* app config for the JS SDK (project afterlife-bureaucracy), used by the
 * referral backend only. These values identify the project, they are not secrets: access is
 * guarded by firestore.rules and App Check.
 *
 * TODO(owner): Firebase console -> Project settings -> General -> Your apps -> add a Web app,
 * then paste its config here (docs/referrals.md, step 7). Until then the referral card
 * reports "couldn't reach the referral office" and the rest of the game is unaffected.
 */
export const firebaseConfig = {
  apiKey: 'TODO_WEB_API_KEY',
  authDomain: 'afterlife-bureaucracy.firebaseapp.com',
  projectId: 'afterlife-bureaucracy',
  storageBucket: 'afterlife-bureaucracy.firebasestorage.app',
  messagingSenderId: 'TODO_SENDER_ID',
  appId: 'TODO_WEB_APP_ID',
};

export function firebaseConfigured(): boolean {
  return !Object.values(firebaseConfig).some((v) => v.startsWith('TODO'));
}
