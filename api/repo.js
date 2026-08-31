// The repository is this site's datastore.
//
// A static site has nowhere else to keep anything that must survive a deploy,
// and a commit costs nothing extra: every change is versioned, attributable
// and revertable, with no second service to pay for or keep alive.
//
// Shared by the admin's save, the journey queue and the approve link, so the
// optimistic-locking rules live in one place rather than three.

const API = 'https://api.github.com';

export function repoConfig() {
  return {
    token: process.env.GITHUB_TOKEN || '',
    repo: process.env.GITHUB_REPO || '',
    branch: process.env.GITHUB_BRANCH || 'main',
  };
}

export const repoReady = (cfg) => Boolean(cfg.token && cfg.repo);

async function call(path, cfg, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + cfg.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ihatejob-site',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* an HTML error page */ }
  if (!res.ok) {
    const err = new Error((json && json.message) || text.slice(0, 200) || ('HTTP ' + res.status));
    err.status = res.status;
    throw err;
  }
  return json;
}

// A file that does not exist yet is a normal starting state, not a failure -
// nothing has been committed the first time anyone submits anything.
export async function readJson(path, cfg) {
  try {
    const file = await call(
      `/repos/${cfg.repo}/contents/${path}?ref=${encodeURIComponent(cfg.branch)}`, cfg,
    );
    const items = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
    return { items: Array.isArray(items) ? items : [], sha: file.sha };
  } catch (err) {
    if (err.status === 404) return { items: [], sha: null };
    throw err;
  }
}

export async function writeJson(path, items, sha, message, cfg) {
  const out = await call(`/repos/${cfg.repo}/contents/${path}`, cfg, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(items, null, 2) + '\n', 'utf8').toString('base64'),
      branch: cfg.branch,
      // Without the sha GitHub refuses the write, which is what stops two
      // submissions arriving at once from overwriting each other.
      ...(sha ? { sha } : {}),
    }),
  });
  return { sha: out.content.sha, commit: out.commit && out.commit.html_url };
}

export const STORIES = 'public/data/stories.json';
