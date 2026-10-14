// Sets the store-listing promo video (YouTube URL) for one language via the Android Publisher API.
// Usage: node scripts/play-listing-video.mjs <service-account.json> <package> <youtubeUrl> [language=en-US]
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const [keyFile, pkg, video, lang = 'en-US'] = process.argv.slice(2);
const key = JSON.parse(readFileSync(keyFile, 'utf8'));
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
const jwt = unsigned + '.' + createSign('RSA-SHA256').update(unsigned).sign(key.private_key).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })).json();
const auth = { authorization: 'Bearer ' + tok.access_token, 'content-type': 'application/json' };
const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/edits`;

const edit = await (await fetch(base, { method: 'POST', headers: auth, body: '{}' })).json();
const cur = await (await fetch(`${base}/${edit.id}/listings/${lang}`, { headers: auth })).json();
console.log('current video:', cur.video ?? '(none)');
const res = await fetch(`${base}/${edit.id}/listings/${lang}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ video }) });
if (!res.ok) { console.error('patch failed', res.status, (await res.text()).slice(0, 400)); process.exit(1); }
const commit = await fetch(`${base}/${edit.id}:commit`, { method: 'POST', headers: auth });
console.log('new video:', video, 'commit', commit.status, commit.ok ? 'ok' : (await commit.text()).slice(0, 400));
