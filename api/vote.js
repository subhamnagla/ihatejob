// Voting on a journey.
//
// GET  /api/vote?slugs=a,b   -> { a: { likes } }        public
// POST /api/vote             -> { ok, likes }           public
//
// Only the like count is ever returned here. Dislikes are counted, and are
// readable at /api/votes-report, which sits behind the admin password.
//
// That split is deliberate. A journey is someone writing about being turned
// down, repeatedly, often for months. A public number telling them how many
// strangers disliked reading it is a way to make the person who was bravest
// here regret it. The signal is worth having; publishing it is not.
//
// Nothing here can be honest about who voted. Without accounts a browser can
// clear its storage and vote again, and the per-address limit only slows a
// determined person down. The counts are indicative, and no claim is made
// anywhere on the site that they are more than that.

import { kvConfig, kvReady, pipeline, readVotes, SLUG, upKey, downKey } from './kv.js';

const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 20;
const seen = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const hits = (seen.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 5000) seen.clear();
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
    if (size > 8 * 1024) throw new Error('too large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  const cfg = kvConfig();

  // Not configured is not an error the page should shout about: the buttons
  // simply do not appear, and the journey reads exactly as it did before.
  if (!kvReady(cfg)) return send(res, 503, { error: 'Voting is not configured here.' });

  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET') {
    const slugs = (url.searchParams.get('slugs') || '').split(',')
      .map((s) => s.trim()).filter(Boolean);
    try {
      const all = await readVotes(slugs, cfg);
      const out = {};
      // Likes only. The dislike half never leaves this function.
      Object.keys(all).forEach((s) => { out[s] = { likes: all[s].likes }; });
      return send(res, 200, out);
    } catch (err) {
      console.error('[vote] ' + (err && err.message));
      return send(res, 502, { error: 'Counts are unavailable just now.' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: 'That did not arrive in one piece.' });
  }

  const slug = String(body.slug || '');
  const vote = String(body.vote || '');
  const previous = String(body.previous || '');

  if (!SLUG.test(slug)) return send(res, 400, { error: 'Unknown journey.' });
  if (vote !== 'up' && vote !== 'down' && vote !== 'none') {
    return send(res, 400, { error: 'Unknown vote.' });
  }
  if (previous && previous !== 'up' && previous !== 'down') {
    return send(res, 400, { error: 'Unknown previous vote.' });
  }
  if (previous === vote) return send(res, 400, { error: 'That vote is already recorded.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) {
    return send(res, 429, { error: 'That is a lot of voting. Try again in a few minutes.' });
  }

  const key = (which) => (which === 'up' ? upKey(slug) : downKey(slug));
  const commands = [];
  // Changing your mind moves the vote rather than adding a second one.
  if (previous) commands.push(['DECR', key(previous)]);
  if (vote !== 'none') commands.push(['INCR', key(vote)]);
  commands.push(['GET', upKey(slug)]);

  try {
    const out = await pipeline(commands, cfg);
    const likes = Number(out[out.length - 1]);
    return send(res, 200, { ok: true, likes: Number.isFinite(likes) && likes > 0 ? likes : 0 });
  } catch (err) {
    console.error('[vote] ' + (err && err.message));
    return send(res, 502, { error: 'That could not be counted just now.' });
  }
}
