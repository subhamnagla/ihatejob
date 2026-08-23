// Admin dashboard.
//
// Everything here is derived from two sources: the project's own data files,
// and the public GitHub API. There is deliberately no third source, because a
// static site has nowhere to keep one and no way to keep it private.

import { SITE, STATS, REVIEWS, MIN_REVIEWS } from './config.js';
import {
  PROFESSIONS, PROFESSION_GROUPS, REGIONS, ALIASES,
} from './professions.js';
import { TEMPLATES, esc } from './templates.js';
import { SAMPLES, missingSamples, buildSample } from './samples.js';
import { SECTIONS, SECTION_IDS } from './schema.js';
import { reviewCV } from './review.js';
import { PLANETS, starsFor } from './planets.js';

const $ = (id) => document.getElementById(id);

$('btnTheme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('ihatejob.theme', next); } catch { /* private mode */ }
});

let toastTimer = 0;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

const REPO_MATCH = String(SITE.repo || '').match(/github\.com\/([^/]+)\/([^/.]+)/);
const OWNER = REPO_MATCH ? REPO_MATCH[1] : '';
const REPO = REPO_MATCH ? REPO_MATCH[2] : '';
const REPO_READY = Boolean(OWNER && REPO && !/your-username/.test(OWNER));

const store = {
  reviews: { items: [], sha: null, dirty: false, canSave: true, note: '' },
  posts: { items: [], sha: null, dirty: false, canSave: true, note: '' },
};

const uid = () => Math.random().toString(36).slice(2, 9);

const when = (iso) => {
  const days = Math.round((Date.now() - new Date(iso)) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return days + ' days ago';
  if (days < 365) return Math.round(days / 30) + ' months ago';
  return Math.round(days / 365) + ' years ago';
};

$('adminSub').textContent = REPO_READY
  ? 'Reading ' + OWNER + '/' + REPO + ' and your config. Nothing else exists to read.'
  : 'No repository configured, so most of this is empty.';

/* ------------------------------------------------------------------ health */

function row(state, label, detail, action) {
  return '<div class="check ' + state + '">'
    + '<span class="dot"></span>'
    + '<div><b>' + esc(label) + '</b><p>' + detail + '</p></div>'
    + (action ? '<span class="check-do">' + action + '</span>' : '')
    + '</div>';
}

function renderHealth() {
  const out = [];

  out.push(REPO_READY
    ? row('ok', 'Repository', 'Suggestions and reviews open as issues on <code>'
      + esc(OWNER + '/' + REPO) + '</code>.')
    : row('bad', 'Repository not set',
      'Every "open an issue" link falls back to the on-page form, and nothing reaches you.',
      'Set <code>SITE.repo</code>'));

  out.push(/.+@.+\..+/.test(SITE.contactEmail || '')
    ? row('ok', 'Contact email', 'Used as a fallback when the repository is unset.')
    : row('warn', 'No contact email',
      'Optional while the repository works, but it is the only channel if GitHub is not an option for someone.',
      'Set <code>SITE.contactEmail</code>'));

  out.push(STATS.endpoint
    ? row('ok', 'Analytics endpoint', 'Visitor numbers appear once they pass '
      + (STATS.minVisitors || 0) + '.')
    : row('warn', 'No analytics',
      'The visitor counters stay off the front page. Nothing is invented in their place.',
      'Set <code>STATS.endpoint</code>'));

  // Count what the site would actually render, not what config.js happens to hold.
  const liveReviews = (store.reviews.items.length ? store.reviews.items : REVIEWS)
    .filter((r) => !r.hidden && String(r.quote || '').trim()).length;
  out.push(liveReviews >= MIN_REVIEWS
    ? row('ok', 'Reviews', liveReviews + ' visible, so the section is live on the front page.')
    : row('warn', 'Reviews hidden',
      liveReviews + ' of ' + MIN_REVIEWS + ' needed. The section stays out of the page entirely until then.',
      'See Reviews below'));

  const url = String(SITE.url || '');
  out.push(/localhost|127\.0\.0\.1/.test(url)
    ? row('warn', 'Share links point at localhost',
      'Every share button copies <code>' + esc(url) + '</code>, which nobody else can open.',
      'Set <code>SITE.url</code>')
    : row('ok', 'Share URL', 'Share links point at <code>' + esc(url) + '</code>.'));

  $('healthList').innerHTML = out.join('');
}
renderHealth();

/* ------------------------------------------------------------------- inbox */

// `review` is not in this list: reviews have their own block above, and having
// them in both turned the to-do list into a place to lose things.
const LABELS = ['profession', 'region', 'template', 'checker', 'bug', 'enhancement'];
let ISSUES = [];
let filter = 'all';

const isReview = (i) => i.labelNames.includes('review');

// The issue template is a list of questions; the answer is the first line
// that is not one of them.
function firstProseLine(body) {
  return String(body || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.endsWith('?') && !l.startsWith('#') && !l.startsWith('-'))[0] || '';
}

// The front-page review form writes a fixed three-line header, so the planet,
// the credit and the consent answer can be lifted back out. Anything written
// by hand simply misses them and falls back to the old behaviour.
function parseReview(body) {
  const text = String(body || '');
  const rank = (text.match(/^Rating:.*?\((\d+) of 10/im) || [])[1];
  const credit = ((text.match(/^Credit:\s*(.+)$/im) || [])[1] || '').trim();
  const consented = /^May be quoted on the site:\s*yes\b/im.test(text);
  const known = /^Rating:/im.test(text);

  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  const quote = known && blocks.length > 1
    ? blocks.slice(1).join('\n\n').trim()
    : firstProseLine(text);

  const [rawName, ...rest] = credit.split(' - ');
  const name = (rawName || '').trim();
  return {
    planet: rank ? Number(rank) : 0,
    name: name.toLowerCase() === 'anonymous' ? '' : name,
    role: rest.join(' - ').trim(),
    consented,
    known,
    quote,
  };
}

function issueHead(i) {
  return '<div class="issue-top">'
    + '<a class="issue-title" href="' + esc(i.html_url) + '" target="_blank" rel="noopener">'
    + esc(i.title) + '</a>'
    + '<span class="issue-meta">#' + i.number + ' &middot; ' + esc(i.user?.login || 'unknown')
    + ' &middot; ' + when(i.created_at) + (i.state === 'closed' ? ' &middot; closed' : '') + '</span>'
    + '</div>';
}

function renderInbox() {
  const all = ISSUES.filter((i) => !isReview(i));
  const filtered = filter === 'all' ? all : all.filter((i) => i.labelNames.includes(filter));

  if (!all.length) {
    $('inboxBody').innerHTML = '<p class="admin-muted">Nothing yet. Suggestions and bug reports '
      + 'from the site arrive here as GitHub issues. Reviews go to the block above.</p>';
    return;
  }
  if (!filtered.length) {
    $('inboxBody').innerHTML = '<p class="admin-muted">No open items with that label.</p>';
    return;
  }

  $('inboxBody').innerHTML = filtered.map((i) => (
    '<article class="issue' + (i.state === 'closed' ? ' closed' : '') + '">'
    + issueHead(i)
    + (i.labelNames.length
      ? '<div class="issue-labels">' + i.labelNames.map((l) => '<span class="lbl l-' + esc(l)
        + '">' + esc(l) + '</span>').join('') + '</div>'
      : '<div class="issue-labels"><span class="lbl l-none">unlabelled</span></div>')
    + (i.body ? '<p class="issue-body">' + esc(i.body.slice(0, 260))
      + (i.body.length > 260 ? '&hellip;' : '') + '</p>' : '')
    + '</article>'
  )).join('');
}

/* --------------------------------------------------------- reviews waiting */

function renderReviewBox() {
  const body = $('reviewboxBody');
  if (!REPO_READY) {
    body.innerHTML = '<p class="admin-muted">No repository configured, so there is nowhere for '
      + 'reviews to arrive.</p>';
    return;
  }

  const items = ISSUES.filter(isReview);
  if (!items.length) {
    body.innerHTML = '<p class="admin-muted">Nothing yet. Reviews from the front-page form arrive '
      + 'here as issues labelled <code>review</code>.</p>';
    return;
  }

  body.innerHTML = items.map((i) => {
    const r = parseReview(i.body);
    const p = PLANETS[r.planet - 1];
    const added = store.reviews.items.some((x) => x.source === i.html_url);

    return '<article class="issue' + (i.state === 'closed' ? ' closed' : '') + '">'
      + issueHead(i)
      + '<div class="issue-labels">'
      + (p
        ? '<span class="lbl l-planet">' + esc(p.name) + ' &middot; ' + starsFor(p.rank)
          + ' stars</span>'
        : '<span class="lbl l-none">no planet given</span>')
      + (r.known
        ? (r.consented
          ? '<span class="lbl l-review">may be quoted</span>'
          : '<span class="lbl l-bad">did not agree to be quoted</span>')
        : '<span class="lbl l-none">written by hand</span>')
      + '</div>'
      + (r.quote ? '<p class="issue-body">' + esc(r.quote.slice(0, 300))
        + (r.quote.length > 300 ? '&hellip;' : '') + '</p>' : '')
      + '<button class="btn btn-sm" data-addreview="' + i.number + '"'
      + (added ? ' disabled' : '') + '>'
      + (added ? 'Already in the list' : 'Add as review') + '</button>'
      + '</article>';
  }).join('');
}

$('reviewboxBody').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-addreview]');
  if (!btn) return;
  const issue = ISSUES.find((i) => String(i.number) === btn.dataset.addreview);
  if (!issue) return;
  if (store.reviews.items.some((r) => r.source === issue.html_url)) {
    toast('That one is already in the review list.');
    return;
  }
  const parsed = parseReview(issue.body);
  // Publishing someone's words is their call. If they did not agree, say so
  // once here rather than leaving it to be noticed later.
  if (parsed.known && !parsed.consented
    && !confirm('This person did not agree to be quoted on the site.\n\n'
      + 'Add it to the list anyway? It arrives hidden either way.')) {
    return;
  }
  store.reviews.items.unshift({
    id: uid(),
    quote: parsed.quote,
    name: parsed.name || (issue.user && issue.user.login ? issue.user.login : ''),
    role: parsed.role,
    place: '',
    planet: parsed.planet || 10,
    source: issue.html_url,
    hidden: true,   // arrives hidden - you decide what goes public
  });
  markDirty('reviews');
  renderReviewsEditor();
  renderReviewBox();
  $('reviews').scrollIntoView({ behavior: 'smooth' });
  toast('Added, hidden for now. Tidy the quote and the credit, then Show and Save.');
});

async function loadInbox() {
  if (!REPO_READY) {
    $('inboxBody').innerHTML = '<p class="admin-muted">No repository configured, so there is '
      + 'nowhere for feedback to arrive.</p>';
    $('inboxFilter').innerHTML = '';
    renderReviewBox();
    return;
  }
  try {
    const res = await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO
      + '/issues?state=all&per_page=100&sort=created&direction=desc');
    if (res.status === 403) throw new Error('GitHub rate limit reached - try again in an hour');
    if (!res.ok) throw new Error('GitHub returned ' + res.status);
    const raw = await res.json();
    // The issues endpoint also returns pull requests; they are not feedback.
    ISSUES = raw.filter((i) => !i.pull_request)
      .map((i) => ({ ...i, labelNames: (i.labels || []).map((l) => l.name) }));

    const others = ISSUES.filter((i) => !isReview(i));
    const counts = { all: others.length };
    LABELS.forEach((l) => { counts[l] = others.filter((i) => i.labelNames.includes(l)).length; });

    $('inboxFilter').innerHTML = ['all', ...LABELS].map((l) => (
      '<button type="button" class="' + (l === filter ? 'sel' : '') + '" data-f="' + l + '">'
      + l + ' <i>' + (counts[l] || 0) + '</i></button>'
    )).join('');
    renderInbox();
    renderReviewBox();
  } catch (err) {
    const msg = '<p class="admin-muted">Could not read GitHub: ' + esc(err.message)
      + '. The public API allows 60 requests an hour per address.</p>';
    $('inboxBody').innerHTML = msg;
    $('reviewboxBody').innerHTML = msg;
  }
}

$('inboxFilter').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-f]');
  if (!btn) return;
  filter = btn.dataset.f;
  $('inboxFilter').querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b === btn));
  renderInbox();
});

/* ----------------------------------------------------------------- traffic */

async function loadTraffic() {
  const body = $('trafficBody');
  const parts = [];

  if (REPO_READY) {
    try {
      const res = await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO);
      if (res.ok) {
        const r = await res.json();
        parts.push('<div class="admin-stats">'
          + stat(r.stargazers_count, 'stars')
          + stat(r.forks_count, 'forks')
          + stat(r.subscribers_count, 'watchers')
          + stat(r.open_issues_count, 'open issues')
          + '</div>'
          + '<p class="admin-muted">Repository created ' + when(r.created_at)
          + ', last pushed ' + when(r.pushed_at) + '.</p>');
      }
    } catch { /* shown as absent below */ }
  }

  if (!STATS.endpoint) {
    parts.push('<p class="admin-muted">No analytics endpoint is configured, so there are no '
      + 'visitor numbers to show &mdash; here or on the front page. Point '
      + '<code>STATS.endpoint</code> at a summary from Plausible, Umami, GoatCounter or your '
      + 'own counter.</p>');
  } else {
    try {
      const res = await fetch(STATS.endpoint, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = STATS.read(await res.json());
      parts.push('<div class="admin-stats">'
        + stat(d.visitors ?? '-', 'visitors')
        + stat(d.pageviews ?? '-', 'page views')
        + stat(d.cvsRated ?? '-', 'CVs rated')
        + '</div>');
    } catch (err) {
      parts.push('<p class="admin-muted">Analytics endpoint unreachable: ' + esc(err.message) + '.</p>');
    }
  }

  body.innerHTML = parts.join('');
}

function stat(value, label) {
  const v = typeof value === 'number' ? value.toLocaleString() : String(value);
  return '<div class="admin-stat"><b>' + esc(v) + '</b><span>' + esc(label) + '</span></div>';
}

/* ----------------------------------------------------------------- content */

function renderContent() {
  const skills = Object.values(SAMPLES).reduce((n, s) => n + (s.k || []).length, 0);
  $('contentStats').innerHTML =
    stat(Object.keys(PROFESSIONS).length, 'professions')
    + stat(Object.keys(REGIONS).length, 'regions')
    + stat(Object.keys(TEMPLATES).length, 'formats')
    + stat(Object.keys(SAMPLES).length, 'sample CVs')
    + stat(SECTION_IDS.length, 'section types')
    + stat(skills, 'skill groups written');

  $('contentBreakdown').innerHTML = '<table class="admin-table"><thead><tr>'
    + '<th>Group</th><th>Professions</th><th>Default formats used</th></tr></thead><tbody>'
    + PROFESSION_GROUPS.map((g) => {
      const tpls = [...new Set(g.items.map((p) => TEMPLATES[p.template]?.name || p.template))];
      return '<tr><td>' + esc(g.name) + '</td><td>' + g.items.length + '</td>'
        + '<td>' + esc(tpls.join(', ')) + '</td></tr>';
    }).join('')
    + '</tbody></table>';
}
renderContent();

/* --------------------------------------------------------------- integrity */

function renderIntegrity() {
  const problems = [];
  const pass = [];

  const noSample = missingSamples();
  (noSample.length ? problems : pass).push({
    label: 'Every profession has a sample CV',
    detail: noSample.length ? 'Missing: ' + noSample.join(', ') : Object.keys(PROFESSIONS).length + ' of ' + Object.keys(PROFESSIONS).length,
  });

  const noAlias = Object.keys(PROFESSIONS).filter((id) => !(ALIASES[id] || []).length);
  (noAlias.length ? problems : pass).push({
    label: 'Every profession is findable by search',
    detail: noAlias.length
      ? 'No search aliases: ' + noAlias.join(', ') + ' - people who type a job title will not find these'
      : 'All have aliases',
  });

  const badSection = [];
  const badTemplate = [];
  for (const [id, p] of Object.entries(PROFESSIONS)) {
    for (const key of ['order', 'require', 'recommend']) {
      for (const sid of p[key] || []) {
        if (!SECTIONS[sid]) badSection.push(id + '.' + key + ' -> ' + sid);
      }
    }
    for (const sid of Object.keys(p.labels || {})) {
      if (!SECTIONS[sid]) badSection.push(id + '.labels -> ' + sid);
    }
    if (!TEMPLATES[p.template]) badTemplate.push(id + ' -> ' + p.template);
  }
  (badSection.length ? problems : pass).push({
    label: 'Professions only reference real sections',
    detail: badSection.length ? badSection.join('; ') : 'All references valid',
  });
  (badTemplate.length ? problems : pass).push({
    label: 'Professions only reference real formats',
    detail: badTemplate.length ? badTemplate.join('; ') : 'All references valid',
  });

  const badRegion = Object.entries(REGIONS)
    .filter(([, r]) => !r.name || !r.pages || !r.photo || !r.personalDetails || !r.note)
    .map(([id]) => id);
  (badRegion.length ? problems : pass).push({
    label: 'Every region is fully specified',
    detail: badRegion.length ? 'Incomplete: ' + badRegion.join(', ') : Object.keys(REGIONS).length + ' complete',
  });

  // A sample that fails its own checker would be a bad thing to hold up as a model.
  const weak = [];
  for (const id of Object.keys(SAMPLES)) {
    try {
      const built = buildSample(id);
      if (!built) continue;
      const r = reviewCV(built, { pages: 1 });
      if (r.score < 80) weak.push(id + ' (' + r.score + ')');
    } catch { /* skip */ }
  }
  (weak.length ? problems : pass).push({
    label: 'Samples score well against their own checker',
    detail: weak.length ? 'Below 80: ' + weak.join(', ') : 'All samples pass',
  });

  $('integrityBody').innerHTML =
    problems.map((p) => row('bad', p.label, esc(p.detail))).join('')
    + pass.map((p) => row('ok', p.label, esc(p.detail))).join('')
    + '<p class="admin-muted" style="margin-top:14px">'
    + (problems.length
      ? problems.length + ' problem' + (problems.length === 1 ? '' : 's') + ' to fix.'
      : 'Everything checks out.') + '</p>';
}


/* ------------------------------------------------- editable content store */

// Reads through the API when saving is configured, and falls back to the
// published file so the admin still shows the truth when it is not.

async function loadContent(key, fallbackUrl) {
  const s = store[key];
  try {
    const res = await fetch('/api/content?file=' + key, { cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    if (!type.includes('json')) {
      // Running without serverless functions - the local dev server answers
      // every unknown path with the landing page.
      throw new Error('the saving API is not running here (local dev server, or functions not deployed)');
    }
    const json = await res.json();
    if (res.status === 503) {
      s.canSave = false;
      s.note = json.detail || 'saving not configured';
      const pub = await fetch(fallbackUrl, { cache: 'no-cache' });
      s.items = pub.ok ? await pub.json() : [];
      return;
    }
    if (!res.ok) throw new Error(json.detail || json.error || ('HTTP ' + res.status));
    s.items = Array.isArray(json.items) ? json.items : [];
    s.sha = json.sha;
    s.canSave = true;
  } catch (err) {
    s.canSave = false;
    s.note = err.message;
    try {
      const pub = await fetch(fallbackUrl, { cache: 'no-cache' });
      s.items = pub.ok ? await pub.json() : [];
    } catch { s.items = []; }
  }
}

async function saveContent(key, label) {
  const s = store[key];
  const state = $(key === 'reviews' ? 'rvState' : 'pbState');
  if (!s.canSave) {
    toast('Saving is not configured: ' + (s.note || 'set GITHUB_TOKEN and GITHUB_REPO'));
    return;
  }
  state.textContent = 'Saving...';
  try {
    const res = await fetch('/api/content?file=' + key, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: s.items, sha: s.sha, message: 'Update ' + label + ' from admin' }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || json.error);
    s.sha = json.sha;
    s.dirty = false;
    state.textContent = 'Saved';
    toast('Committed. The site rebuilds in about a minute.');
  } catch (err) {
    state.textContent = 'Not saved';
    toast('Could not save: ' + err.message);
  }
}

function markDirty(key) {
  store[key].dirty = true;
  $(key === 'reviews' ? 'rvState' : 'pbState').textContent = 'Unsaved changes';
}

// Typing must not rebuild the list, or focus is lost on every keystroke. Only
// structural actions redraw.
function bindFields(root, key, onStructural) {
  root.addEventListener('input', (e) => {
    const el = e.target.closest('[data-k]');
    if (!el) return;
    const items = store[key].items;
    const item = items[Number(el.closest('[data-i]').dataset.i)];
    if (!item) return;
    if (el.type === 'checkbox') item[el.dataset.k] = el.checked;
    // data-num keeps a <select> from writing "5" where the site expects 5.
    else if (el.type === 'number' || el.hasAttribute('data-num')) {
      item[el.dataset.k] = Number(el.value);
    } else item[el.dataset.k] = el.value;
    markDirty(key);
  });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const items = store[key].items;
    const i = Number(btn.closest('[data-i]').dataset.i);
    const act = btn.dataset.act;

    if (act === 'del') {
      if (!confirm('Delete this permanently?')) return;
      items.splice(i, 1);
    } else if (act === 'up' && i > 0) {
      [items[i - 1], items[i]] = [items[i], items[i - 1]];
    } else if (act === 'down' && i < items.length - 1) {
      [items[i + 1], items[i]] = [items[i], items[i + 1]];
    } else if (act === 'hide') {
      items[i].hidden = !items[i].hidden;
    } else if (act === 'pin') {
      items[i].pinned = !items[i].pinned;
    } else {
      return;
    }
    markDirty(key);
    onStructural();
  });
}

/* ---------------------------------------------------------- reviews editor */

// The same derivation the site uses, so the planet shown here is the planet
// the visitor will see. Entries written before the scale carried stars only.
function rankOf(r) {
  const rank = Number(r.planet);
  if (rank >= 1 && rank <= 10) return Math.round(rank);
  const legacy = Number(r.rating);
  if (legacy >= 1 && legacy <= 5) return Math.round(legacy * 2);
  return 10;
}

function renderReviewsEditor() {
  const items = store.reviews.items;
  const live = items.filter((r) => !r.hidden && String(r.quote || '').trim()).length;
  const list = $('rvList');

  if (!store.reviews.canSave) $('rvState').textContent = 'Read only';
  else if (!store.reviews.dirty) $('rvState').textContent = '';

  const banner = '<p class="admin-muted" style="margin-bottom:14px"><b>' + live
    + '</b> visible of ' + items.length + '. '
    + (live >= 3
      ? 'The section is live on the front page.'
      : 'Needs ' + (3 - live) + ' more visible before the section appears at all.')
    + (store.reviews.canSave ? '' : ' <b>Read only</b> &mdash; ' + esc(store.reviews.note))
    + '</p>';

  if (!items.length) {
    list.innerHTML = banner + '<p class="admin-muted">Nothing here yet. Use '
      + '<b>Add as review</b> on a feedback item above, or <b>Add blank</b>.</p>';
    return;
  }

  list.innerHTML = banner + items.map((r, i) => (
    '<div class="edit' + (r.hidden ? ' off' : '') + '" data-i="' + i + '">'
    + '<div class="edit-bar">'
    + '<span class="edit-n">' + (i + 1) + '</span>'
    + '<b>' + esc(r.name || 'Unnamed') + '</b>'
    + '<span class="tag-planet">' + esc(PLANETS[rankOf(r) - 1].name) + '</span>'
    + (r.pinned ? '<span class="tag-pin">pinned</span>' : '')
    + (r.hidden
      ? '<span class="tag-off">hidden</span>'
      : (String(r.quote || '').trim()
        ? '<span class="tag-on">visible</span>'
        : '<span class="tag-off">empty</span>'))
    + '<span class="spacer"></span>'
    + '<button class="btn btn-sm" data-act="pin" type="button">' + (r.pinned ? 'Unpin' : 'Pin') + '</button>'
    + '<button class="btn btn-sm" data-act="hide" type="button">' + (r.hidden ? 'Show' : 'Hide') + '</button>'
    + '<button class="btn btn-sm btn-icon" data-act="up" type="button" aria-label="Move up">&#9650;</button>'
    + '<button class="btn btn-sm btn-icon" data-act="down" type="button" aria-label="Move down">&#9660;</button>'
    + '<button class="btn btn-sm btn-icon btn-danger" data-act="del" type="button" aria-label="Delete">&#10005;</button>'
    + '</div>'
    + '<div class="grid">'
    + '<div class="field"><label>Quote</label>'
    + '<textarea class="input" rows="3" data-k="quote">' + esc(r.quote || '') + '</textarea></div>'
    + '<div class="field s4"><label>Name</label>'
    + '<input class="input" data-k="name" value="' + esc(r.name || '') + '"></div>'
    + '<div class="field s4"><label>Role</label>'
    + '<input class="input" data-k="role" value="' + esc(r.role || '') + '"></div>'
    + '<div class="field s4"><label>Place</label>'
    + '<input class="input" data-k="place" value="' + esc(r.place || '') + '"></div>'
    + '<div class="field s6"><label>Planet &mdash; this is the rating</label>'
    + '<select class="select" data-k="planet" data-num>'
    + PLANETS.map((p) => (
      '<option value="' + p.rank + '"' + (rankOf(r) === p.rank ? ' selected' : '') + '>'
      + esc(p.rank + '. ' + p.name + ' - ' + starsFor(p.rank) + ' stars') + '</option>'
    )).join('')
    + '</select></div>'
    + '<div class="field s6"><label>Source link</label>'
    + '<input class="input" data-k="source" value="' + esc(r.source || '') + '"></div>'
    + '</div></div>'
  )).join('');
}

bindFields($('rvList'), 'reviews', renderReviewsEditor);

$('rvAdd').addEventListener('click', () => {
  store.reviews.items.unshift({
    id: uid(), quote: '', name: '', role: '', place: '', planet: 10, hidden: true,
  });
  markDirty('reviews');
  renderReviewsEditor();
});
$('rvSave').addEventListener('click', () => saveContent('reviews', 'reviews'));

/* ------------------------------------------------------------- blog editor */

const slugify = (t) => String(t).toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function renderPostsEditor() {
  const items = store.posts.items;
  const list = $('pbList');
  const live = items.filter((p) => p.published).length;

  if (!store.posts.canSave) $('pbState').textContent = 'Read only';
  else if (!store.posts.dirty) $('pbState').textContent = '';

  const banner = '<p class="admin-muted" style="margin-bottom:14px"><b>' + live
    + '</b> published of ' + items.length + '.'
    + (store.posts.canSave ? '' : ' <b>Read only</b> &mdash; ' + esc(store.posts.note))
    + '</p>';

  if (!items.length) {
    list.innerHTML = banner + '<p class="admin-muted">No posts yet.</p>';
    return;
  }

  list.innerHTML = banner + items.map((p, i) => (
    '<div class="edit' + (p.published ? '' : ' off') + '" data-i="' + i + '">'
    + '<div class="edit-bar">'
    + '<span class="edit-n">' + (i + 1) + '</span>'
    + '<b>' + esc(p.title || 'Untitled') + '</b>'
    + (p.published ? '<span class="tag-on">published</span>' : '<span class="tag-off">draft</span>')
    + '<span class="spacer"></span>'
    + '<a class="btn btn-sm" href="/blog/' + esc(p.slug || '') + '" target="_blank" rel="noopener">View</a>'
    + '<button class="btn btn-sm btn-icon" data-act="up" type="button" aria-label="Move up">&#9650;</button>'
    + '<button class="btn btn-sm btn-icon" data-act="down" type="button" aria-label="Move down">&#9660;</button>'
    + '<button class="btn btn-sm btn-icon btn-danger" data-act="del" type="button" aria-label="Delete">&#10005;</button>'
    + '</div>'
    + '<div class="grid">'
    + '<div class="field s6"><label>Title</label>'
    + '<input class="input" data-k="title" value="' + esc(p.title || '') + '"></div>'
    + '<div class="field s6"><label>Slug (the URL)</label>'
    + '<input class="input" data-k="slug" value="' + esc(p.slug || '') + '"></div>'
    + '<div class="field s6"><label>Date</label>'
    + '<input class="input" type="date" data-k="date" value="' + esc(p.date || '') + '"></div>'
    + '<div class="field s6" style="display:flex;align-items:flex-end">'
    + '<label class="check"><input type="checkbox" data-k="published"'
    + (p.published ? ' checked' : '') + '><span>Published</span></label></div>'
    + '<div class="field"><label>Excerpt</label>'
    + '<textarea class="input" rows="2" data-k="excerpt">' + esc(p.excerpt || '') + '</textarea></div>'
    + '<div class="field"><label>Body (Markdown)</label>'
    + '<textarea class="input mono" rows="12" data-k="body">' + esc(p.body || '') + '</textarea></div>'
    + '</div></div>'
  )).join('');
}

bindFields($('pbList'), 'posts', renderPostsEditor);

$('pbAdd').addEventListener('click', () => {
  store.posts.items.unshift({
    id: uid(),
    title: 'Untitled post',
    slug: 'untitled-' + uid(),
    date: new Date().toISOString().slice(0, 10),
    excerpt: '',
    body: '',
    published: false,
  });
  markDirty('posts');
  renderPostsEditor();
});
$('pbSave').addEventListener('click', () => saveContent('posts', 'blog posts'));

// A slug is derived from the title only while it is still the generated one,
// so renaming a published post never silently breaks its URL.
$('pbList').addEventListener('input', (e) => {
  const el = e.target.closest('[data-k="title"]');
  if (!el) return;
  const i = Number(el.closest('[data-i]').dataset.i);
  const post = store.posts.items[i];
  if (post && /^untitled-/.test(post.slug || '')) {
    post.slug = slugify(el.value) || post.slug;
    const slugField = el.closest('[data-i]').querySelector('[data-k="slug"]');
    if (slugField) slugField.value = post.slug;
  }
});

// Leaving with unsaved edits loses them, since nothing is stored locally.
window.addEventListener('beforeunload', (e) => {
  if (store.reviews.dirty || store.posts.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* -------------------------------------------------------------------- boot */

async function refresh() {
  renderHealth();
  renderContent();
  renderIntegrity();
  await Promise.all([
    loadInbox(),
    loadTraffic(),
    loadContent('reviews', '/data/reviews.json').then(renderReviewsEditor),
    loadContent('posts', '/data/posts.json').then(renderPostsEditor),
  ]);
}

$('btnRefresh').addEventListener('click', () => {
  refresh();
  toast('Refreshed.');
});

refresh();
