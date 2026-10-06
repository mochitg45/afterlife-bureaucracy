import { Capacitor, registerPlugin } from '@capacitor/core';
import { getBackend } from './firebase';

/** Where the game lives on Play; the referral code rides in the install `referrer` param. */
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.afterlifebureaucracy.game';

/** Unambiguous: no 0/O, 1/I or L. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;
const CODE_RE = /^[A-HJKMNP-Z2-9]{8}$/;

export function referralLink(code: string): string {
  return `${PLAY_URL}&referrer=${encodeURIComponent('ref=' + code)}`;
}

/** `ref=ABCD2345` (what Play hands back, already decoded) to the code, or null. */
export function parseReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  const code = new URLSearchParams(referrer).get('ref');
  return code && CODE_RE.test(code) ? code : null;
}

export function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  // 256 % 31 is not 0, so the first few letters are a hair likelier; irrelevant for a handle.
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export type JoinResult = 'joined' | 'none' | 'error';

/**
 * The referral backend. Every method resolves; none throws. Anything that goes wrong -- no
 * network, no Play services, App Check refusing the install -- comes back as 'error' / null
 * and the UI says "couldn't reach the referral office".
 */
export interface Referral {
  /** False off Android: the feature is hidden there. */
  available(): boolean;
  /** This player's own code, created on first use. Null if the backend could not be reached. */
  myCode(): Promise<string | null>;
  /**
   * First launch of an invited install: if the Play install referrer carries a code, file a
   * referral for it. 'none' is a definitive "not an invited install" (or already used device).
   */
  registerJoin(): Promise<JoinResult>;
  /** Flips this install's referral to qualified (first Annual Audit filed). */
  markQualified(): Promise<'ok' | 'error'>;
  /** Genuine (qualified) joins this player has brought in; null if unreachable. */
  countJoined(): Promise<number | null>;
}

/** The in-repo Android plugin, `android/app/src/main/java/.../ReferralPlugin.java`. */
interface ReferralNativePlugin {
  getInstallReferrer(): Promise<{ referrer: string | null }>;
  getDeviceHash(): Promise<{ hash: string }>;
}

const ReferralNative = registerPlugin<ReferralNativePlugin>('Referral');

export const REFERRAL_TIMEOUT_MS = 15_000;

/** A Firestore call that never settles (offline writes wait for the server) is a failure. */
function withTimeout<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), REFERRAL_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

const CODE_KEY = 'afterlife.referralCode';

function readCode(): string | null {
  try {
    const v = localStorage.getItem(CODE_KEY);
    return v && CODE_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

function writeCode(code: string) {
  try {
    localStorage.setItem(CODE_KEY, code);
  } catch {
    /* private mode: the code is re-minted next launch, which is harmless */
  }
}

export const playReferral: Referral = {
  available() {
    try {
      return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    } catch {
      return false;
    }
  },

  async myCode() {
    try {
      const saved = readCode();
      if (saved) return saved;
      return await withTimeout(mintCode());
    } catch {
      return null;
    }
  },

  async registerJoin() {
    try {
      const { referrer } = await ReferralNative.getInstallReferrer();
      const code = parseReferrer(referrer);
      if (!code) return 'none';
      return await withTimeout(joinWith(code));
    } catch {
      return 'error';
    }
  },

  async markQualified() {
    try {
      await withTimeout(qualify());
      return 'ok';
    } catch {
      return 'error';
    }
  },

  async countJoined() {
    try {
      return await withTimeout(count());
    } catch {
      return null;
    }
  },
};

async function mintCode(): Promise<string> {
  const { db, uid } = await getBackend();
  const { doc, runTransaction } = await import('firebase/firestore');
  // A transaction rather than a bare setDoc: it fails fast offline instead of queueing a write
  // that would resolve whenever the network next shows up, and the create-only rule turns a
  // code collision into a permission error that simply draws another code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    try {
      await runTransaction(db, async (tx) => {
        if ((await tx.get(doc(db, 'codes', code))).exists()) throw Object.assign(new Error('taken'), { code: 'already-exists' });
        tx.set(doc(db, 'codes', code), { uid });
      });
      writeCode(code);
      return code;
    } catch (e) {
      if ((e as { code?: string }).code !== 'already-exists' && (e as { code?: string }).code !== 'permission-denied') throw e;
    }
  }
  throw new Error('no free code');
}

async function joinWith(code: string): Promise<JoinResult> {
  const { db, uid } = await getBackend();
  const { doc, getDoc, runTransaction, serverTimestamp } = await import('firebase/firestore');
  const inviter = await getDoc(doc(db, 'codes', code));
  const inviterUid = inviter.exists() ? (inviter.data().uid as unknown) : null;
  if (typeof inviterUid !== 'string' || inviterUid === uid) return 'none';
  const { hash: deviceHash } = await ReferralNative.getDeviceHash();
  try {
    // Both create-only docs in one commit: if this device was ever referred, its device doc
    // exists, the create is refused, and neither doc is written. (Devices cannot be read, so
    // "did it exist" can only be asked this way.)
    await runTransaction(db, async (tx) => {
      tx.set(doc(db, 'devices', deviceHash), { uid, at: serverTimestamp() });
      tx.set(doc(db, 'referrals', uid), { inviterUid, deviceHash, qualified: false, createdAt: serverTimestamp() });
    });
    return 'joined';
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied') return 'none'; // device already referred
    throw e;
  }
}

async function qualify(): Promise<void> {
  const { db, uid } = await getBackend();
  const { doc, runTransaction } = await import('firebase/firestore');
  await runTransaction(db, async (tx) => {
    tx.update(doc(db, 'referrals', uid), { qualified: true });
  });
}

async function count(): Promise<number> {
  const { db, uid } = await getBackend();
  const { collection, query, where, getCountFromServer } = await import('firebase/firestore');
  const q = query(collection(db, 'referrals'), where('inviterUid', '==', uid), where('qualified', '==', true));
  return (await getCountFromServer(q)).data().count;
}

/** Web and iOS: no referral. */
export const noopReferral: Referral = {
  available: () => false,
  myCode: async () => null,
  registerJoin: async () => 'none',
  markQualified: async () => 'error',
  countJoined: async () => null,
};

export function pickReferral(): Referral {
  return playReferral.available() ? playReferral : noopReferral;
}

/** Scriptable stand-in for tests. */
export function memoryReferral(
  opts: { available?: boolean; code?: string; join?: JoinResult; joined?: number | null; fail?: boolean } = {},
): Referral & { qualifiedCalls: number; registerCalls: number } {
  const fake = {
    qualifiedCalls: 0,
    registerCalls: 0,
    available: () => opts.available ?? true,
    myCode: async () => (opts.fail ? null : opts.code ?? 'ABCD2345'),
    registerJoin: async (): Promise<JoinResult> => {
      fake.registerCalls++;
      return opts.fail ? 'error' : opts.join ?? 'none';
    },
    markQualified: async (): Promise<'ok' | 'error'> => {
      fake.qualifiedCalls++;
      return opts.fail ? 'error' : 'ok';
    },
    countJoined: async () => (opts.fail ? null : opts.joined ?? 0),
  };
  return fake;
}
