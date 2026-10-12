// Creates + activates one-time IAPs via the new Play monetization API (oneTimeProducts). Usage: node scripts/play-iap.mjs <key.json> <package>. Edit `products` first.
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const [keyFile, pkg] = process.argv.slice(2);
const key = JSON.parse(readFileSync(keyFile, 'utf8'));
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
const jwt = unsigned + '.' + createSign('RSA-SHA256').update(unsigned).sign(key.private_key).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })).json();
const auth = { authorization: 'Bearer ' + tok.access_token, 'content-type': 'application/json' };
const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/inappproducts`;

const products = [
  ['weekly_vouchers_200', 1.99, '200 Weekly Event Vouchers', '200 vouchers for the weekly event gacha. Leftovers carry over to the next weekly event.'],
  ['weekly_vouchers_550', 4.99, '550 Weekly Event Vouchers', '550 vouchers for the weekly event gacha. Leftovers carry over to the next weekly event.'],
  ['weekly_bundle', 2.99, 'Weekly Event Bundle', '300 Weekly Event Vouchers plus 100 Requisition Vouchers.'],
  ['holiday_vouchers_200', 1.99, '200 Holiday Event Vouchers', '200 vouchers for the holiday event gacha. Leftovers carry over to the next holiday event.'],
  ['holiday_vouchers_1200', 9.99, '1,200 Holiday Event Vouchers', '1,200 vouchers for the holiday event gacha. Leftovers carry over to the next holiday event.'],
  ['holiday_bundle', 5.99, 'Holiday Event Bundle', '700 Holiday Event Vouchers plus 200 Requisition Vouchers.'],
  ['weekly_pass', 1.99, 'Weekly Event Pass', 'Every reward on the running weekly event track pays 3x, including tiers already claimed.'],
  ['holiday_pass', 3.99, 'Holiday Event Pass', 'Every reward on the running holiday event track pays 3x, including tiers already claimed.'],
];

const base2 = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}`;
const money = (usd) => ({ currencyCode: 'USD', units: String(Math.floor(usd)), nanos: Math.round((usd % 1) * 1e9) });
for (const [sku, usd, title, description] of products) {
  const conv = await (await fetch(`${base2}/pricing:convertRegionPrices`, { method: 'POST', headers: auth, body: JSON.stringify({ price: money(usd) }) })).json();
  if (!conv.convertedRegionPrices) { console.log(sku, 'convert failed', JSON.stringify(conv).slice(0, 300)); continue; }
  const configs = Object.values(conv.convertedRegionPrices).map((r) => ({ regionCode: r.regionCode, price: r.price, availability: 'AVAILABLE' }));
  const body = {
    packageName: pkg, productId: sku,
    listings: [{ languageCode: 'en-US', title, description }],
    purchaseOptions: [{ purchaseOptionId: 'buy', buyOption: { legacyCompatible: true }, regionalPricingAndAvailabilityConfigs: configs }],
  };
  const url = `${base2}/oneTimeProducts/${sku}?allowMissing=true&updateMask=listings,purchaseOptions&regionsVersion.version=2025/03`;
  let r, t;
  for (let tries = 0; tries < 40; tries++) {
    r = await fetch(url, { method: 'PATCH', headers: auth, body: JSON.stringify(body) });
    t = await r.text();
    const bad = /Region code (\w+) is not billable/.exec(t)?.[1];
    const cur = /region code (\w+) at .* Expected (\w+) but/.exec(t);
    if (r.ok || (!bad && !cur)) break;
    const cfgs = body.purchaseOptions[0].regionalPricingAndAvailabilityConfigs;
    if (bad) body.purchaseOptions[0].regionalPricingAndAvailabilityConfigs = cfgs.filter((c) => c.regionCode !== bad);
    else if (cur[2] === 'USD') cfgs.find((c) => c.regionCode === cur[1]).price = money(usd);
    else body.purchaseOptions[0].regionalPricingAndAvailabilityConfigs = cfgs.filter((c) => c.regionCode !== cur[1]);
  }
  if (!r.ok) { console.log(sku, r.status, t.slice(0, 400)); continue; }
  const a = await fetch(`${base2}/oneTimeProducts/${sku}/purchaseOptions:batchUpdateStates`, { method: 'POST', headers: auth,
    body: JSON.stringify({ requests: [{ activatePurchaseOptionRequest: { packageName: pkg, productId: sku, purchaseOptionId: 'buy' } }] }) });
  console.log(sku, 'created', configs.length, 'regions; activate', a.status, a.ok ? '' : (await a.text()).slice(0, 300));
}
