// Exercises the public submit endpoint's guards. It is the one unauthenticated
// write path on the site, so every rejection below is load-bearing.

import handler from '../api/submit.js';

const NL = String.fromCharCode(10);
let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails += 1; console.log('FAIL  ' + label + '  want ' + JSON.stringify(want) + ', got ' + JSON.stringify(got)); }
  else console.log('ok    ' + label);
};

// Minimal req/res doubles, plus a stub for the outbound mail call.
function makeRes() {
  const res = { statusCode: 0, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = (s) => { res.body = s ? JSON.parse(s) : null; };
  return res;
}
const post = async (body, { method = 'POST', ip = '1.2.3.4' } = {}) => {
  const req = { method, headers: { 'x-forwarded-for': ip }, socket: {}, body };
  const res = makeRes();
  await handler(req, res);
  return res;
};

const good = () => ({
  kind: 'review',
  title: 'Uranus - Asha R',
  body: 'Rating: Uranus (7 of 10)\nCredit: Asha R\n\nThe licence check caught a real gap.',
  website: '',
  startedAt: Date.now() - 30_000,
});

process.env.RESEND_API_KEY = '';
process.env.NOTIFY_EMAIL = '';

console.log('=== without credentials ===');
let r = await post(good());
check('503 when not configured', r.statusCode, 503);
check('does not leak env detail', /key|secret|resend/i.test(JSON.stringify(r.body)), false);

process.env.RESEND_API_KEY = 'test-key';
process.env.NOTIFY_EMAIL = 'owner@example.test';

// Intercept the mail call so nothing leaves the machine.
let mailed = null;
let failMail = false;
globalThis.fetch = async (url, opts) => {
  mailed = { url, opts, body: JSON.parse(opts.body) };
  if (failMail) return { ok: false, status: 401, text: async () => 'invalid key re_live_secret' };
  return { ok: true, json: async () => ({ id: 'mail-1' }), text: async () => '' };
};

console.log(NL + '=== rejections ===');
r = await post(good(), { method: 'GET' });
check('GET refused', r.statusCode, 405);

r = await post({ ...good(), kind: 'not-a-kind' });
check('unknown kind refused', r.statusCode, 400);

r = await post({ ...good(), kind: '__proto__' });
check('prototype key refused', r.statusCode, 400);

r = await post({ ...good(), startedAt: Date.now() });
check('submitted instantly refused', r.statusCode, 429);

r = await post({ ...good(), startedAt: 'nonsense' });
check('missing timestamp refused', r.statusCode, 429);

r = await post({ ...good(), title: '' });
check('no title refused', r.statusCode, 400);

r = await post({ ...good(), body: 'too short' });
check('too-short body refused', r.statusCode, 400);

r = await post({ ...good(), body: 'buy https://a.test https://b.test https://c.test https://d.test now' });
check('link spam refused', r.statusCode, 400);

mailed = null;
r = await post({ ...good(), website: 'http://spam.test' }, { ip: '9.9.9.9' });
check('honeypot accepted quietly', r.statusCode, 200);
check('honeypot sent nothing', mailed, null);

console.log(NL + '=== a real submission ===');
mailed = null;
r = await post(good(), { ip: '5.5.5.5' });
check('accepted', r.statusCode, 200);
check('emailed to the owner', mailed.body.to, ['owner@example.test']);
check('subject carries the prefix', mailed.body.subject, 'Review: Uranus - Asha R');
check('body kept', mailed.body.text.includes('licence check'), true);
check('kind on its own line for mail filters', mailed.body.text.startsWith('Kind: review'), true);
check('marked as from a visitor', mailed.body.text.includes('The visitor has no account'), true);
check('default sender until a domain is verified', mailed.body.from, 'onboarding@resend.dev');
check('key not in the URL', mailed.url.includes('test-key'), false);
check('key sent as a header', mailed.opts.headers.Authorization, 'Bearer test-key');

console.log(NL + '=== nothing reaches GitHub ===');
check('no GitHub call', /github/i.test(mailed.url), false);
check('no issue number invented', 'number' in r.body, false);
check('no issue URL invented', 'url' in r.body, false);

console.log(NL + '=== a custom sender ===');
process.env.NOTIFY_FROM = 'hello@ihatejob.com';
await post(good(), { ip: '5.5.5.6' });
check('NOTIFY_FROM used when set', mailed.body.from, 'hello@ihatejob.com');
delete process.env.NOTIFY_FROM;

console.log(NL + '=== rate limit ===');
const burst = [];
for (let i = 0; i < 7; i += 1) {
  // eslint-disable-next-line no-await-in-loop
  burst.push((await post(good(), { ip: '7.7.7.7' })).statusCode);
}
check('first five accepted', burst.slice(0, 5), [200, 200, 200, 200, 200]);
check('sixth throttled', burst[5], 429);
check('a different address is unaffected', (await post(good(), { ip: '8.8.8.8' })).statusCode, 200);

console.log(NL + '=== control characters ===');
mailed = null;
await post({ ...good(), title: 'Nul' + String.fromCharCode(0) + 'led' + String.fromCharCode(27) + '[31m title' }, { ip: '6.6.6.6' });
check('control chars stripped', /[\u0000-\u001F]/.test(mailed.body.subject), false);

console.log(NL + '=== the mail provider failing ===');
failMail = true;
r = await post(good(), { ip: '6.6.6.7' });
check('reported as a 502', r.statusCode, 502);
check('no provider detail reaches the visitor',
  /resend|re_live|invalid key|owner@/i.test(JSON.stringify(r.body)), false);
failMail = false;

console.log(NL + (fails ? fails + ' FAILING' : 'all pass'));
process.exit(fails ? 1 : 0);
