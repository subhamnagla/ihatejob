// Receives a review, a journey or a suggestion from the site.
//
// This exists so that leaving a review does not require a GitHub account.
// Sending people to a sign-up page to say "this helped" loses almost all of
// them, and the ones it does not lose are not representative.
//
// The submission is filed as a GitHub issue using the site's own token, so the
// visitor never sees GitHub, and the admin's queue, labels, parsing and reply
// threads all keep working exactly as before.
//
// This endpoint is deliberately outside the admin's middleware matcher: it has
// to be public. Everything below is there because of that.
//
// Required environment variables (the same ones the admin already uses):
//   GITHUB_TOKEN   fine-grained PAT with Issues: read and write on this repo
//   GITHUB_REPO    owner/repo, e.g. subhamnagla/ihatejob

const API = 'https://api.github.com';

// Only labels the site itself offers. Never take a label from the request.
const KINDS = {
  review: { label: 'review', prefix: 'Review: ' },
  story: { label: 'story', prefix: 'Story: ' },
  profession: { label: 'profession', prefix: 'New profession: ' },
  region: { label: 'region', prefix: 'Region rules: ' },
  template: { label: 'template', prefix: 'New format: ' },
  checker: { label: 'checker', prefix: 'Checker rule: ' },
  bug: { label: 'bug', prefix: 'Bug: ' },
  idea: { label: 'enhancement', prefix: 'Idea: ' },
};

const MAX_TITLE = 160;
const MAX_BODY = 8000;
const MIN_BODY = 12;
const MIN_SECONDS = 3;     // a human cannot read the form and submit faster
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 5;

// Best effort: a serverless instance keeps this only while it is warm, and
// there may be several. It still stops the obvious flood, and the honeypot and
// timing checks catch what it misses.
const seen = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const hits = (seen.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 5000) seen.clear();   // never grow without bound
  return hits.length > PER_WINDOW;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('too large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

const clean = (s, max) => String(s == null ? '' : s)
  // Strip control characters, keeping tab and newline.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim()
  .slice(0, max);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const TOKEN = process.env.GITHUB_TOKEN;
  const REPO = process.env.GITHUB_REPO;
  if (!TOKEN || !REPO) {
    // The form falls back to its copy button on this, and says so.
    return send(res, 503, {
      error: 'Not configured',
      detail: 'Sending is not set up on this deployment yet.',
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: 'That did not arrive in one piece. Try again.' });
  }

  // hasOwn, not a bare lookup: `kind: "__proto__"` resolves to Object.prototype,
  // which is truthy, and would have walked straight past this check.
  const kindKey = String(body.kind || '');
  if (!Object.prototype.hasOwnProperty.call(KINDS, kindKey)) {
    return send(res, 400, { error: 'Unknown kind of message.' });
  }
  const kind = KINDS[kindKey];

  // Bots fill in every field they find, including the one CSS hides.
  if (String(body.website || '').trim()) return send(res, 200, { ok: true, skipped: true });

  const elapsed = (Date.now() - Number(body.startedAt || 0)) / 1000;
  if (!Number.isFinite(elapsed) || elapsed < MIN_SECONDS) {
    return send(res, 429, { error: 'That was too quick. Give it a moment and try again.' });
  }

  const title = clean(body.title, MAX_TITLE);
  const text = clean(body.body, MAX_BODY);
  if (!title) return send(res, 400, { error: 'A one-line summary is needed.' });
  if (text.length < MIN_BODY) return send(res, 400, { error: 'Add a little more detail first.' });

  // Almost every spam submission is a wall of links.
  const links = (text.match(/https?:\/\//gi) || []).length;
  if (links > 3) return send(res, 400, { error: 'That has too many links in it to accept.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) {
    return send(res, 429, { error: 'That is several in a row. Try again in a few minutes.' });
  }

  // The submitter is anonymous to GitHub - the issue is opened by the site's
  // own token - so the body has to carry who they said they are. The admin
  // reads the credit line rather than the GitHub account.
  const footer = '\n\n---\nSent from the site by a visitor. Not a GitHub account.';

  try {
    const r = await fetch(`${API}/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + TOKEN,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ihatejob-site',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: kind.prefix + title,
        body: text + footer,
        labels: [kind.label],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      // Never hand a GitHub error back to a visitor - it can name the repo or
      // the token's scopes.
      console.error('[submit] GitHub ' + r.status + ': ' + detail.slice(0, 300));
      return send(res, 502, { error: 'That could not be sent just now. Please try again shortly.' });
    }

    const issue = await r.json();
    return send(res, 200, { ok: true, number: issue.number, url: issue.html_url });
  } catch (err) {
    console.error('[submit] ' + (err && err.message));
    return send(res, 502, { error: 'That could not be sent just now. Please try again shortly.' });
  }
}
