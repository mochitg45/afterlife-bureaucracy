// Prompts every player on an older build to update, via Play's app recovery (remote in-app update).
// Usage: node scripts/play-recovery.mjs <service-account.json> <package> <code,code,...>
// Codes still served by an active track (e.g. a testing track) are rejected by Play; they are
// dropped one by one and retried, and reported at the end.
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const [keyFile, pkg, list] = process.argv.slice(2);
const key = JSON.parse(readFileSync(keyFile, 'utf8'));
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
const jwt = unsigned + '.' + createSign('RSA-SHA256').update(unsigned).sign(key.private_key).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })).json();
const auth = { authorization: 'Bearer ' + tok.access_token, 'content-type': 'application/json' };
const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/appRecoveries`;

// Codes served by any track's live release can't be targeted: read them from a throwaway edit.
const api = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}`;
const edit = await (await fetch(`${api}/edits`, { method: 'POST', headers: auth, body: '{}' })).json();
const { tracks = [] } = await (await fetch(`${api}/edits/${edit.id}/tracks`, { headers: auth })).json();
await fetch(`${api}/edits/${edit.id}`, { method: 'DELETE', headers: auth });
const active = new Set(tracks.flatMap((t) => (t.releases ?? []).filter((r) => r.status !== 'draft').flatMap((r) => r.versionCodes ?? [])));
let codes = list.split(',').map((c) => c.trim()).filter(Boolean);
const dropped = codes.filter((c) => active.has(c));
codes = codes.filter((c) => !active.has(c));
for (const t of tracks) console.log('track', t.track, (t.releases ?? []).map((r) => `${r.status}:${(r.versionCodes ?? []).join('+')}`).join(' '));
while (codes.length) {
  const res = await fetch(base, { method: 'POST', headers: auth, body: JSON.stringify({
    targeting: { versionList: { versionCodes: codes }, allUsers: { isAllUsersRequested: true } },
    remoteInAppUpdate: { isRemoteInAppUpdateRequested: true },
  }) });
  const body = await res.json();
  if (res.ok) {
    const id = body.appRecoveryId;
    const dep = await fetch(`${base}/${id}:deploy`, { method: 'POST', headers: auth, body: '{}' });
    console.log('recovery', id, 'codes', codes.join(','), 'deploy', dep.status, dep.ok ? '' : JSON.stringify(await dep.json()).slice(0, 300));
    break;
  }
  const msg = JSON.stringify(body);
  const bad = codes.find((c) => new RegExp(`\\b${c}\\b`).test(body.error?.message ?? ''));
  if (!bad) { console.error('create failed', res.status, msg.slice(0, 500)); process.exit(1); }
  console.log('dropping', bad, '-', (body.error?.message ?? '').slice(0, 160));
  dropped.push(bad);
  codes = codes.filter((c) => c !== bad);
}
if (dropped.length) console.log('not targeted (still on an active track):', dropped.join(','));
