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

// Minimal req/res doubles, plus a stub for the GitHub call.
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

process.env.GITHUB_TOKEN = '';
process.env.GITHUB_REPO = '';

console.log('=== without credentials ===');
let r = await post(good());
check('503 when not configured', r.statusCode, 503);
check('does not leak env detail', /token|secret/i.test(JSON.stringify(r.body)), false);

process.env.GITHUB_TOKEN = 'test-token';
process.env.GITHUB_REPO = 'someone/somewhere';

// Intercept both outbound calls so nothing leaves the machine.
let sent = null;      // the GitHub issue
let mailed = null;    // the Resend email
let failGithub = false;
let failMail = false;
globalThis.fetch = async (url, opts) => {
  const rec = { url, opts, body: JSON.parse(opts.body) };
  if (String(url).includes('resend.com')) {
    mailed = rec;
    if (failMail) return { ok: false, status: 401, text: async () => 'bad key sk_live_secret' };
    return { ok: true, json: async () => ({ id: 'mail-1' }), text: async () => '' };
  }
  sent = rec;
  if (failGithub) return { ok: false, status: 403, text: async () => 'token scope missing' };
  return {
    ok: true,
    json: async () => ({ number: 42, html_url: 'https://example.test/issues/42' }),
    text: async () => '',
  };
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

sent = null;
r = await post({ ...good(), website: 'http://spam.test' }, { ip: '9.9.9.9' });
check('honeypot accepted quietly', r.statusCode, 200);
check('honeypot filed nothing', sent, null);

console.log(NL + '=== a real submission ===');
sent = null;
r = await post(good(), { ip: '5.5.5.5' });
check('accepted', r.statusCode, 200);
check('reports the issue number', r.body.number, 42);
check('label is from the allowlist', sent.body.labels, ['review']);
check('title carries the prefix', sent.body.title, 'Review: Uranus - Asha R');
check('body kept', sent.body.body.includes('licence check'), true);
check('marked as from a visitor', sent.body.body.includes('No account was involved'), true);
check('token not in the URL', sent.url.includes('test-token'), false);
check('token sent as a header', sent.opts.headers.Authorization, 'Bearer test-token');

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
sent = null;
await post({ ...good(), title: 'Nul' + String.fromCharCode(0) + 'led' + String.fromCharCode(27) + '[31m title' }, { ip: '6.6.6.6' });
check('control chars stripped', /[\u0000-\u001F]/.test(sent.body.title), false);

console.log(NL + '=== email as the only channel ===');
process.env.GITHUB_TOKEN = '';
process.env.GITHUB_REPO = '';
process.env.RESEND_API_KEY = 'test-key';
process.env.NOTIFY_EMAIL = 'owner@example.test';

sent = null; mailed = null;
r = await post(good(), { ip: '10.0.0.1' });
check('accepted on email alone', r.statusCode, 200);
check('nothing filed on GitHub', sent, null);
check('emailed to the owner', mailed.body.to, ['owner@example.test']);
check('subject carries the prefix', mailed.body.subject, 'Review: Uranus - Asha R');
check('body kept', mailed.body.text.includes('licence check'), true);
check('no issue number invented', 'number' in r.body, false);
check('key sent as a header', mailed.opts.headers.Authorization, 'Bearer test-key');
check('key not in the URL', mailed.url.includes('test-key'), false);
check('default sender until a domain is verified', mailed.body.from, 'onboarding@resend.dev');

console.log(NL + '=== both channels ===');
process.env.GITHUB_TOKEN = 'test-token';
process.env.GITHUB_REPO = 'someone/somewhere';

sent = null; mailed = null;
r = await post(good(), { ip: '10.0.0.2' });
check('filed and emailed', [Boolean(sent), Boolean(mailed)], [true, true]);
check('still reports the issue number', r.body.number, 42);

console.log(NL + '=== one channel failing ===');
failGithub = true;
r = await post(good(), { ip: '10.0.0.3' });
check('email alone still counts as sent', r.statusCode, 200);
check('no issue number when GitHub failed', 'number' in r.body, false);

failGithub = false; failMail = true;
r = await post(good(), { ip: '10.0.0.4' });
check('GitHub alone still counts as sent', r.statusCode, 200);

failGithub = true;
r = await post(good(), { ip: '10.0.0.5' });
check('both failing is a 502', r.statusCode, 502);
check('no provider detail reaches the visitor',
  /resend|github|scope|sk_live/i.test(JSON.stringify(r.body)), false);
failGithub = false; failMail = false;

console.log(NL + (fails ? fails + ' FAILING' : 'all pass'));
process.exit(fails ? 1 : 0);
