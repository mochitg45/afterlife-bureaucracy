/**
 * Firebase *web* app config for the JS SDK (project afterlife-bureaucracy), used by the
 * referral backend only. These values identify the project, they are not secrets: access is
 * guarded by firestore.rules and App Check.
 *
 * From the "Afterlife Web (referrals)" web app in the Firebase console.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyAFo3WedaKd_ab6SdvIHtCINInBreODLbM',
  authDomain: 'afterlife-bureaucracy.firebaseapp.com',
  projectId: 'afterlife-bureaucracy',
  storageBucket: 'afterlife-bureaucracy.firebasestorage.app',
  messagingSenderId: '1035420780939',
  appId: '1:1035420780939:web:5c6ada7c73ab96b109c78e',
};

export function firebaseConfigured(): boolean {
  return !Object.values(firebaseConfig).some((v) => v.startsWith('TODO'));
}
