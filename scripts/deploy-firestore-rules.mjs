// Deploys firestore.rules without the Firebase CLI: creates a ruleset and points the
// cloud.firestore release at it. Usage: node scripts/deploy-firestore-rules.mjs <service-account.json> <projectId>
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const [keyFile, project] = process.argv.slice(2);
const key = JSON.parse(readFileSync(keyFile, 'utf8'));
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
const jwt = unsigned + '.' + createSign('RSA-SHA256').update(unsigned).sign(key.private_key).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })).json();
const auth = { authorization: 'Bearer ' + tok.access_token, 'content-type': 'application/json' };
const api = `https://firebaserules.googleapis.com/v1/projects/${project}`;

const content = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const rs = await fetch(`${api}/rulesets`, { method: 'POST', headers: auth, body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content }] } }) });
const ruleset = await rs.json();
if (!rs.ok) { console.error('ruleset failed', rs.status, JSON.stringify(ruleset).slice(0, 600)); process.exit(1); }
const name = `projects/${project}/releases/cloud.firestore`;
const rel = await fetch(`${api}/releases/cloud.firestore`, { method: 'PATCH', headers: auth, body: JSON.stringify({ release: { name, rulesetName: ruleset.name } }) });
console.log('ruleset', ruleset.name, 'release', rel.status, rel.ok ? 'ok' : JSON.stringify(await rel.json()).slice(0, 600));
