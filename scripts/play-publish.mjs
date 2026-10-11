// Uploads an AAB to the Play production track via the Android Publisher API (no deps).
// Usage: node scripts/play-publish.mjs <service-account.json> <package> <aab> <versionCode>
// The key is _secrets/google-cloud/afterlife-bureaucracy-*.json (revenuecat@ service account,
// granted "Release to production" + "Release apps to testing tracks" on 2026-10-11). Edit the
// release notes below before each run.
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const [keyFile, pkg, aab, versionCode] = process.argv.slice(2);
const key = JSON.parse(readFileSync(keyFile, 'utf8'));
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
  aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
});
const jwt = unsigned + '.' + createSign('RSA-SHA256').update(unsigned).sign(key.private_key).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
})).json();
if (!tok.access_token) { console.error('token failed', tok); process.exit(1); }
const auth = { authorization: 'Bearer ' + tok.access_token };
const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}`;
const call = async (method, url, body, headers = {}) => {
  const r = await fetch(url, { method, headers: { ...auth, ...headers }, body });
  const t = await r.text();
  if (!r.ok) { console.error(method, url.replace(base, ''), r.status, t); process.exit(1); }
  return t ? JSON.parse(t) : {};
};

const edit = await call('POST', `${base}/edits`, '{}', { 'content-type': 'application/json' });
console.log('edit', edit.id);
const up = await call('POST', `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${pkg}/edits/${edit.id}/bundles?uploadType=media`,
  readFileSync(aab), { 'content-type': 'application/octet-stream' });
console.log('uploaded versionCode', up.versionCode);
if (String(up.versionCode) !== String(versionCode)) { console.error('unexpected versionCode'); process.exit(1); }
const notes = [
  { language: 'en-US', text: 'Fixed weekly event cards showing a blank ghost. New card flips with rarity spotlights, event ranking prizes for 1st, 2nd and 3rd, achievement and event prize popups, event cards that work without equip slots, and automatic updates to the latest version.' },
];
await call('PUT', `${base}/edits/${edit.id}/tracks/production`, JSON.stringify({
  track: 'production', releases: [{ name: `1.1.5 (${versionCode})`, versionCodes: [String(versionCode)], status: 'completed', releaseNotes: notes }],
}), { 'content-type': 'application/json' });
console.log('production track set');
const done = await call('POST', `${base}/edits/${edit.id}:commit`);
console.log('committed', done.id);
