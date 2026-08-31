// Voting. The public endpoint must never hand back a dislike count, and a slug
// must never be able to write outside its own two keys.

import vote from '../api/vote.js';
import report from '../api/votes-report.js';

const NL = String.fromCharCode(10);
let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails += 1; console.log('FAIL  ' + label + '  want ' + JSON.stringify(want) + ', got ' + JSON.stringify(got)); }
  else console.log('ok    ' + label);
};

const res = () => {
  const r = { statusCode: 0, headers: {}, body: null };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (s) => { r.body = s ? JSON.parse(s) : null; };
  return r;
};

// A Redis of sorts: enough to prove the commands sent are the right ones.
let store = {};
let sent = [];
globalThis.fetch = async (url, opts) => {
  const cmds = JSON.parse(opts.body);
  sent.push(...cmds);
  const out = cmds.map((c) => {
    const [op, ...args] = c;
    if (op === 'INCR') { store[args[0]] = (store[args[0]] || 0) + 1; return { result: store[args[0]] }; }
    if (op === 'DECR') { store[args[0]] = (store[args[0]] || 0) - 1; return { result: store[args[0]] }; }
    if (op === 'GET') return { result: store[args[0]] == null ? null : String(store[args[0]]) };
    if (op === 'MGET') return { result: args.map((k) => (store[k] == null ? null : String(store[k]))) };
    return { result: null };
  });
  return { ok: true, text: async () => JSON.stringify(out) };
};

let n = 0;
const call = async (handler, { method = 'GET', url = '/api/vote', body = null } = {}) => {
  n += 1;
  const r = res();
  await handler({ method, url, headers: { 'x-forwarded-for': '20.0.0.' + (n % 200) }, socket: {}, body }, r);
  return r;
};
const post = (body, ip) => {
  const r = res();
  return vote({ method: 'POST', url: '/api/vote', headers: { 'x-forwarded-for': ip || '20.1.1.1' }, socket: {}, body }, r)
    .then(() => r);
};

console.log('=== without a store ===');
process.env.KV_REST_API_URL = '';
process.env.KV_REST_API_TOKEN = '';
check('GET is 503', (await call(vote)).statusCode, 503);
check('POST is 503', (await call(vote, { method: 'POST', body: { slug: 'a', vote: 'up' } })).statusCode, 503);
check('report is 503', (await call(report, { url: '/api/votes-report' })).statusCode, 503);

process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 'kv-token';

console.log(NL + '=== casting a vote ===');
store = {}; sent = [];
let r = await post({ slug: 'my-journey', vote: 'up', previous: '' });
check('accepted', r.statusCode, 200);
check('like counted', store['v:my-journey:up'], 1);
check('reports the new count', r.body.likes, 1);
check('nothing touched the dislike key', store['v:my-journey:down'], undefined);

console.log(NL + '=== changing your mind ===');
sent = [];
r = await post({ slug: 'my-journey', vote: 'down', previous: 'up' });
check('accepted', r.statusCode, 200);
check('like taken back', store['v:my-journey:up'], 0);
check('dislike counted', store['v:my-journey:down'], 1);
check('the public count drops', r.body.likes, 0);

console.log(NL + '=== taking a vote back ===');
r = await post({ slug: 'my-journey', vote: 'none', previous: 'down' });
check('accepted', r.statusCode, 200);
check('dislike removed', store['v:my-journey:down'], 0);

console.log(NL + '=== the public endpoint hides dislikes ===');
store = { 'v:a:up': 7, 'v:a:down': 4, 'v:b:up': 1, 'v:b:down': 99 };
r = await call(vote, { url: '/api/vote?slugs=a,b' });
check('likes returned', [r.body.a.likes, r.body.b.likes], [7, 1]);
check('no dislike key anywhere in the reply',
  /dislike/i.test(JSON.stringify(r.body)), false);
check('the numbers themselves do not leak', JSON.stringify(r.body).includes('99'), false);
check('shape is likes-only', Object.keys(r.body.a), ['likes']);

console.log(NL + '=== the admin sees both ===');
r = await call(report, { url: '/api/votes-report?slugs=a,b' });
check('likes and dislikes', [r.body.a.likes, r.body.a.dislikes], [7, 4]);
check('second slug too', [r.body.b.likes, r.body.b.dislikes], [1, 99]);
check('report refuses POST', (await call(report, { method: 'POST', url: '/api/votes-report' })).statusCode, 405);

console.log(NL + '=== a slug cannot escape its own keys ===');
for (const bad of ['../../etc', 'a b', 'A-Upper', 'v:x:up', '-leading', 'x'.repeat(90), '']) {
  const out = await post({ slug: bad, vote: 'up' });
  if (out.statusCode !== 400) { fails += 1; console.log('FAIL  rejected slug: ' + JSON.stringify(bad) + ' -> ' + out.statusCode); }
}
console.log('ok    every malformed slug refused');

store = {};
await call(vote, { url: '/api/vote?slugs=' + encodeURIComponent('v:a:up,../x, ,GOOD-one') });
check('malformed slugs are dropped from reads, not queried', Object.keys(store).length, 0);

console.log(NL + '=== malformed votes ===');
check('unknown direction', (await post({ slug: 'x', vote: 'sideways' })).statusCode, 400);
check('unknown previous', (await post({ slug: 'x', vote: 'up', previous: 'maybe' })).statusCode, 400);
check('voting the same way twice', (await post({ slug: 'x', vote: 'up', previous: 'up' })).statusCode, 400);
check('GET refused on POST-only shape', (await call(vote, { method: 'DELETE' })).statusCode, 405);

console.log(NL + '=== rate limit ===');
const burst = [];
for (let i = 0; i < 22; i += 1) {
  // eslint-disable-next-line no-await-in-loop
  burst.push((await post({ slug: 'spam-target', vote: 'up' }, '33.33.33.33')).statusCode);
}
check('first twenty accepted', burst.slice(0, 20).every((s) => s === 200), true);
check('twenty-first throttled', burst[20], 429);
check('another address unaffected', (await post({ slug: 'spam-target', vote: 'up' }, '44.44.44.44')).statusCode, 200);

console.log(NL + '=== the store failing ===');
globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'redis exploded at kv.test' });
r = await post({ slug: 'my-journey', vote: 'up' }, '55.55.55.55');
check('reported as 502', r.statusCode, 502);
check('no infrastructure detail reaches the visitor',
  /redis|kv\.test|token/i.test(JSON.stringify(r.body)), false);

console.log(NL + (fails ? fails + ' FAILING' : 'all pass'));
process.exit(fails ? 1 : 0);
