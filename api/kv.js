// A counter store, over HTTP.
//
// Votes are the one thing on this site that git cannot hold: a commit and a
// full rebuild per click, and two people voting at once collide on the sha and
// one of them is lost. Everything else here still lives in the repository.
//
// Upstash exposes Redis over REST, so this is plain fetch and no dependency -
// the site still installs nothing to run.
//
// Vercel's Marketplace integration injects these when you add Redis to the
// project. The UPSTASH_ names are what you get connecting to Upstash directly,
// and both are accepted so neither route needs a manual copy-paste.
//   KV_REST_API_URL / KV_REST_API_TOKEN
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN

export function kvConfig() {
  return {
    url: (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, ''),
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
  };
}

export const kvReady = (cfg) => Boolean(cfg.url && cfg.token);

// One round trip for however many commands. Reading a listing of twenty
// journeys is forty counters, and forty requests would be absurd.
export async function pipeline(commands, cfg) {
  if (!commands.length) return [];
  const res = await fetch(cfg.url + '/pipeline', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + cfg.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error('KV ' + res.status + ': ' + text.slice(0, 200));
    err.status = res.status;
    throw err;
  }
  const out = JSON.parse(text);
  // Upstash answers a pipeline with one object per command, in order.
  return out.map((r) => (r && Object.prototype.hasOwnProperty.call(r, 'result') ? r.result : null));
}

// A slug becomes part of a key, so it is checked rather than trusted. This is
// also what stops a crafted slug from writing wherever it likes in the store.
export const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

export const upKey = (slug) => 'v:' + slug + ':up';
export const downKey = (slug) => 'v:' + slug + ':down';

const toCount = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Reads both directions for every slug in one trip. The caller decides which
// halves it is allowed to show.
export async function readVotes(slugs, cfg) {
  const clean = slugs.filter((s) => SLUG.test(s)).slice(0, 100);
  if (!clean.length) return {};
  const keys = [];
  clean.forEach((s) => { keys.push(upKey(s), downKey(s)); });
  const values = await pipeline([['MGET', ...keys]], cfg);
  const row = Array.isArray(values[0]) ? values[0] : [];
  const out = {};
  clean.forEach((s, i) => {
    out[s] = { likes: toCount(row[i * 2]), dislikes: toCount(row[i * 2 + 1]) };
  });
  return out;
}
