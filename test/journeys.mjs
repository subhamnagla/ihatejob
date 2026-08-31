// The journey pipeline: a visitor's submission is queued unpublished, the
// email carries a link that publishes it, and consent is honoured at both ends.

import submit from '../api/submit.js';
import approve from '../api/approve.js';

const NL = String.fromCharCode(10);
let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails += 1; console.log('FAIL  ' + label + '  want ' + JSON.stringify(want) + ', got ' + JSON.stringify(got)); }
  else console.log('ok    ' + label);
};

process.env.RESEND_API_KEY = 'test-key';
process.env.NOTIFY_EMAIL = 'owner@example.test';
process.env.GITHUB_TOKEN = 'test-token';
process.env.GITHUB_REPO = 'someone/somewhere';
process.env.SITE_URL = 'https://ihatejob.app';

// The repository, in memory. Every write lands here and every read sees it,
// so the sha check and the queue behave the way they do against GitHub.
let repo = [];
let sha = 'sha-0';
let mailed = null;
let writes = 0;
let failWrite = false;

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);

  if (u.includes('resend.com')) {
    mailed = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ id: 'm1' }), text: async () => '' };
  }

  if (u.includes('/contents/')) {
    if (!opts.method || opts.method === 'GET') {
      return {
        ok: true,
        text: async () => JSON.stringify({
          content: Buffer.from(JSON.stringify(repo), 'utf8').toString('base64'),
          sha,
        }),
      };
    }
    if (failWrite) {
      return { ok: false, status: 409, text: async () => JSON.stringify({ message: 'sha does not match' }) };
    }
    const body = JSON.parse(opts.body);
    repo = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
    writes += 1;
    sha = 'sha-' + writes;
    return {
      ok: true,
      text: async () => JSON.stringify({ content: { sha }, commit: { html_url: 'https://x.test/c' } }),
    };
  }

  throw new Error('unexpected fetch: ' + u);
};

const resJson = () => {
  const res = { statusCode: 0, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = (s) => { res.body = s ? JSON.parse(s) : null; };
  return res;
};
const resHtml = () => {
  const res = { statusCode: 0, headers: {}, body: '' };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = (s) => { res.body = String(s || ''); };
  return res;
};

let ip = 0;
const send = async (title, body) => {
  ip += 1;
  const res = resJson();
  await submit({
    method: 'POST',
    headers: { 'x-forwarded-for': '10.1.0.' + ip },
    socket: {},
    body: { kind: 'story', title, body, website: '', startedAt: Date.now() - 30_000 },
  }, res);
  return res;
};

const approveId = async (id, method = 'GET') => {
  const res = resHtml();
  await approve({ method, url: '/api/approve?id=' + encodeURIComponent(id || '') }, res);
  return res;
};

const story = (consent = 'yes') => [
  'Outcome: Offer at an NHS trust',
  'Credit: Asha R - Staff nurse',
  'May be published on the site: ' + consent,
  '',
  'Took four months. The licence section was what kept getting me rejected.',
].join(NL);

console.log('=== a journey arrives ===');
let r = await send('How I got hired after four months', story());
check('accepted', r.statusCode, 200);
check('queued into the repo', repo.length, 1);

const q = repo[0];
check('queued UNPUBLISHED', q.published, false);
check('consent recorded', q.consent, true);
check('title kept', q.title, 'How I got hired after four months');
check('slug derived', q.slug, 'how-i-got-hired-after-four-months');
check('outcome parsed', q.outcome, 'Offer at an NHS trust');
check('name parsed', q.name, 'Asha R');
check('role parsed', q.role, 'Staff nurse');
check('header stripped from body', q.body.startsWith('Took four months'), true);
check('body kept whole', q.body.includes('kept getting me rejected'), true);

console.log(NL + '=== the email carries the link ===');
check('approve link present', mailed.text.includes('/api/approve?id=' + q.id), true);
check('link is absolute', mailed.text.includes('https://ihatejob.app/api/approve'), true);
check('says it needs the password', mailed.text.includes('admin password'), true);

console.log(NL + '=== approving it ===');
r = await approveId(q.id);
check('published', r.statusCode, 200);
check('flag flipped in the repo', repo[0].published, true);
check('page names the journey', r.body.includes('How I got hired'), true);
check('links to the live page', r.body.includes('/stories/' + q.slug), true);
check('not indexable', r.headers['X-Robots-Tag'], 'noindex, nofollow');

console.log(NL + '=== clicking twice ===');
const before = writes;
r = await approveId(q.id);
check('second click is a no-op', r.body.includes('Already published'), true);
check('committed nothing further', writes, before);

console.log(NL + '=== consent is honoured ===');
await send('A journey they did not want published', story('no'));
const no = repo.find((s) => s.title.includes('did not want'));
check('still queued', Boolean(no), true);
check('consent recorded as false', no.consent, false);
check('no approve link emailed', mailed.text.includes('/api/approve?id='), false);
check('email says why', mailed.text.includes('answered "no"'), true);

r = await approveId(no.id);
check('approving it is refused', r.statusCode, 403);
check('still unpublished', repo.find((s) => s.id === no.id).published, false);

console.log(NL + '=== slugs stay unique ===');
await send('How I got hired after four months', story());
const slugs = repo.map((s) => s.slug);
check('colliding title gets its own slug',
  slugs.filter((s) => s.startsWith('how-i-got-hired-after-four-months')).sort(),
  ['how-i-got-hired-after-four-months', 'how-i-got-hired-after-four-months-2']);
check('no duplicate slugs anywhere', new Set(slugs).size, slugs.length);

console.log(NL + '=== bad requests ===');
check('unknown id is 404', (await approveId('sub-nope')).statusCode, 404);
check('missing id is 400', (await approveId('')).statusCode, 400);
check('POST refused', (await approveId(q.id, 'POST')).statusCode, 405);

console.log(NL + '=== a write conflict ===');
failWrite = true;
r = await approveId(repo.find((s) => !s.published && s.consent).id);
check('conflict reported, not swallowed', r.statusCode, 409);
failWrite = false;

console.log(NL + '=== reviews are not queued ===');
repo = [];
const rv = resJson();
await submit({
  method: 'POST', headers: { 'x-forwarded-for': '10.9.9.9' }, socket: {},
  body: { kind: 'review', title: 'Nice', body: 'Rating: Jupiter (5 of 10)', startedAt: Date.now() - 30_000 },
}, rv);
check('review accepted', rv.statusCode, 200);
check('nothing written to stories.json', repo.length, 0);
check('no approve link on a review', mailed.text.includes('/api/approve'), false);

console.log(NL + '=== queueing failure must not lose the journey ===');
process.env.GITHUB_TOKEN = '';
mailed = null;
r = await send('Sent while the repo was unreachable', story());
check('still accepted', r.statusCode, 200);
check('still emailed in full', mailed.text.includes('Took four months'), true);
check('no approve link offered', mailed.text.includes('/api/approve'), false);
process.env.GITHUB_TOKEN = 'test-token';

console.log(NL + '=== approve without credentials ===');
process.env.GITHUB_TOKEN = '';
check('503 when unconfigured', (await approveId('sub-x')).statusCode, 503);
process.env.GITHUB_TOKEN = 'test-token';

console.log(NL + (fails ? fails + ' FAILING' : 'all pass'));
process.exit(fails ? 1 : 0);
