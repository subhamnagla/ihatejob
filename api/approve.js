// Publishes one journey, from the link in the email that announced it.
//
// The link sits behind the admin middleware, and that is deliberately the
// entire security model: no signing scheme to get subtly wrong, no second
// secret to store and rotate, and a browser that has opened the admin once
// will not ask again. Anyone who can approve a journey could already have
// published it by hand.
//
// Approving only flips a flag. The submission is already in stories.json with
// published:false, so the admin can read, edit or delete it either way, and a
// journey nobody approves simply never becomes visible.

import { repoConfig, repoReady, readJson, writeJson, STORIES } from './repo.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function page(res, status, heading, detail, link) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(`<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(heading)} - ihatejob</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.55 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         margin: 0; display: grid; place-items: center; min-height: 100vh; padding: 24px; }
  main { max-width: 34rem; }
  h1 { font-size: 1.35rem; margin: 0 0 .5rem; }
  p { margin: 0 0 1rem; opacity: .85; }
  a { color: inherit; }
</style>
<main><h1>${esc(heading)}</h1><p>${esc(detail)}</p>${link || ''}</main>`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return page(res, 405, 'Method not allowed', 'Open this link in a browser.');
  }

  const cfg = repoConfig();
  if (!repoReady(cfg)) {
    return page(res, 503, 'Publishing is not configured',
      'GITHUB_TOKEN and GITHUB_REPO are not set on this deployment, so nothing can be published.');
  }

  const id = new URL(req.url, 'http://localhost').searchParams.get('id') || '';
  if (!id) return page(res, 400, 'No journey named', 'That link is missing its id.');

  try {
    const { items, sha } = await readJson(STORIES, cfg);
    const story = items.find((s) => s.id === id);

    if (!story) {
      return page(res, 404, 'Not found',
        'No journey with that id. It may have been deleted from the admin.');
    }

    const view = `<p><a href="/stories/${encodeURIComponent(story.slug)}">Open the journey</a> &middot; `
      + '<a href="/admin">Admin</a></p>';

    // Saying "published" twice must not commit twice - a second click is a
    // refresh, a forwarded email or a mail client prefetching the link.
    if (story.published) {
      return page(res, 200, 'Already published',
        `"${story.title}" is already live. Nothing changed.`, view);
    }

    // The form asked whether it could be published and this person said no.
    // Honouring that is the whole reason for asking.
    if (story.consent === false) {
      return page(res, 403, 'They did not agree to this',
        `"${story.title}" was sent with "May be published on the site: no". `
        + 'Ask them first, then publish it from the admin.', '<p><a href="/admin">Admin</a></p>');
    }

    story.published = true;
    await writeJson(STORIES, items, sha, 'Publish journey: ' + story.title, cfg);

    return page(res, 200, 'Published',
      `"${story.title}" is live in about a minute, once the site finishes rebuilding.`, view);
  } catch (err) {
    if (err.status === 409 || /does not match/i.test(err.message || '')) {
      return page(res, 409, 'Something else changed it first',
        'Another save landed while this one was in flight. Open the link again.');
    }
    // A GitHub error can name the repository and the token's scopes, so it is
    // logged rather than shown - even here, where the reader is the owner.
    console.error('[approve] ' + (err && err.message));
    return page(res, 502, 'That could not be published just now',
      'Try the link again shortly, or publish it from the admin.',
      '<p><a href="/admin">Admin</a></p>');
  }
}
