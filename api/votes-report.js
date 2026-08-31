// Both halves of the vote, for the one person entitled to see them.
//
// GET /api/votes-report?slugs=a,b -> { a: { likes, dislikes } }
//
// middleware.js puts the admin password in front of this. /api/vote returns
// likes to anyone; the dislike count is only ever readable here, so that the
// person who wrote about being turned down for eleven months never gets shown
// a tally of strangers who did not care for it.

import { kvConfig, kvReady, readVotes } from './kv.js';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const cfg = kvConfig();
  if (!kvReady(cfg)) {
    return send(res, 503, {
      error: 'Voting is not configured',
      detail: 'Add Redis to the project in Vercel and redeploy.',
    });
  }

  const slugs = (new URL(req.url, 'http://localhost').searchParams.get('slugs') || '')
    .split(',').map((s) => s.trim()).filter(Boolean);

  try {
    return send(res, 200, await readVotes(slugs, cfg));
  } catch (err) {
    console.error('[votes-report] ' + (err && err.message));
    return send(res, 502, { error: 'Counts are unavailable just now.' });
  }
}
