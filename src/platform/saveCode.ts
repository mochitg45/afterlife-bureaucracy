/**
 * Export/import save code.
 *
 * Format: `AB1.<base64url of the UTF-8 json>.<8 hex digits of FNV-1a over the same UTF-8 bytes>`.
 * The checksum is an integrity check against truncated or mistyped codes, not a security
 * measure — a save code is player-editable by design and the engine still validates the
 * decoded state through the normal save schema.
 */

export const SAVE_CODE_PREFIX = 'AB1.';

const PREFIX_TAG = 'AB1';
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const CHECKSUM = /^[0-9a-f]{8}$/;

function invalid(): never {
  throw new Error('Invalid save code');
}

/** FNV-1a (32-bit) over raw bytes, rendered as 8 lowercase hex digits. */
export function fnv1a(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    // hash * 16777619 without overflowing the double mantissa
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000; // keep String.fromCharCode below the argument limit
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeSave(json: string): string {
  const bytes = new TextEncoder().encode(json);
  const body = bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${SAVE_CODE_PREFIX}${body}.${fnv1a(bytes)}`;
}

export function decodeSave(code: string): string {
  const parts = code.trim().split('.');
  if (parts.length !== 3) invalid();
  const [tag, body, checksum] = parts;
  if (tag !== PREFIX_TAG || !BASE64URL.test(body) || !CHECKSUM.test(checksum)) invalid();

  let bytes: Uint8Array;
  try {
    const padded = body.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(body.length / 4) * 4, '=');
    bytes = base64ToBytes(padded);
  } catch {
    invalid();
  }
  if (fnv1a(bytes) !== checksum) invalid();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    invalid();
  }
}
