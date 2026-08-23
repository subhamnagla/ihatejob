// Reads and writes the site's editable content.
//
// A static site has no database, so the repository is the database: this
// commits JSON files back to GitHub, which makes Vercel redeploy. Slower than
// a real store by a minute or so, but every change is versioned, attributable
// and revertable, and there is no extra service to pay for or keep alive.
//
// Access is gated by middleware.js before this runs. The GitHub token lives in
// an environment variable and never reaches the browser.
//
// Required environment variables:
//   GITHUB_TOKEN   a fine-grained PAT with Contents: read and write on this repo
//   GITHUB_REPO    owner/repo, e.g. subhamnagla/ihatejob
//   GITHUB_BRANCH  optional, defaults to main

const FILES = {
  reviews: 'public/data/reviews.json',
  posts: 'public/data/posts.json',
};

const API = 'https://api.github.com';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function github(path, token, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ihatejob-admin',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const msg = (json && json.message) || text.slice(0, 200) || ('HTTP ' + res.status);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  const TOKEN = process.env.GITHUB_TOKEN;
  const REPO = process.env.GITHUB_REPO;
  const BRANCH = process.env.GITHUB_BRANCH || 'main';

  if (!TOKEN || !REPO) {
    return send(res, 503, {
      error: 'Saving is not configured',
      detail: 'Set GITHUB_TOKEN and GITHUB_REPO in the Vercel project settings. '
        + 'Until then the admin can read content but not save it.',
    });
  }

  const url = new URL(req.url, 'http://localhost');
  const key = url.searchParams.get('file');
  const path = FILES[key];
  if (!path) {
    return send(res, 400, { error: 'Unknown file', detail: 'Expected one of: ' + Object.keys(FILES).join(', ') });
  }

  try {
    if (req.method === 'GET') {
      try {
        const file = await github(
          `/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`, TOKEN,
        );
        const json = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
        return send(res, 200, { items: json, sha: file.sha });
      } catch (err) {
        // Not committed yet is a normal starting state, not a failure.
        if (err.status === 404) return send(res, 200, { items: [], sha: null });
        throw err;
      }
    }

    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (!Array.isArray(body.items)) {
        return send(res, 400, { error: 'Expected { items: [...] }' });
      }

      const content = Buffer
        .from(JSON.stringify(body.items, null, 2) + '\n', 'utf8')
        .toString('base64');

      const payload = {
        message: body.message || `Update ${key} from admin`,
        content,
        branch: BRANCH,
        // Without the sha GitHub rejects the write, which is what stops two
        // admin tabs silently overwriting each other.
        ...(body.sha ? { sha: body.sha } : {}),
      };

      try {
        const out = await github(`/repos/${REPO}/contents/${path}`, TOKEN, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        return send(res, 200, {
          ok: true,
          sha: out.content.sha,
          commit: out.commit.html_url,
          note: 'Committed. Vercel will redeploy in about a minute.',
        });
      } catch (err) {
        if (err.status === 409 || /does not match/i.test(err.message)) {
          return send(res, 409, {
            error: 'Someone else changed this file',
            detail: 'Reload the admin page to pick up their version, then reapply your change.',
          });
        }
        throw err;
      }
    }

    res.setHeader('Allow', 'GET, PUT');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return send(res, err.status === 401 || err.status === 403 ? 403 : 500, {
      error: 'GitHub rejected the request',
      detail: err.message,
    });
  }
}
