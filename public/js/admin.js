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

  out.push(REVIEWS.length >= MIN_REVIEWS
    ? row('ok', 'Reviews', REVIEWS.length + ' published, so the section is live.')
    : row('warn', 'Reviews hidden',
      REVIEWS.length + ' of ' + MIN_REVIEWS + ' needed. The section stays out of the page entirely until then.',
      'Add to <code>REVIEWS</code>'));

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

const LABELS = ['review', 'profession', 'region', 'template', 'checker', 'bug', 'enhancement'];
let ISSUES = [];
let filter = 'all';

function reviewSnippet(issue) {
  // Turn an issue into something that can be pasted straight into config.js.
  const first = String(issue.body || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.endsWith('?') && !l.startsWith('#'))[0] || '';
  return '{\n'
    + "  quote: '" + first.replace(/'/g, "\\'").slice(0, 200) + "',\n"
    + "  name: '" + (issue.user?.login || '') + "',\n"
    + "  role: '',\n"
    + "  place: '',\n"
    + "  source: '" + issue.html_url + "',\n"
    + '},';
}

function renderInbox() {
  const filtered = filter === 'all' ? ISSUES : ISSUES.filter((i) => i.labelNames.includes(filter));

  if (!ISSUES.length) {
    $('inboxBody').innerHTML = '<p class="admin-muted">Nothing yet. Every suggestion and review '
      + 'from the site arrives here as a GitHub issue.</p>';
    return;
  }
  if (!filtered.length) {
    $('inboxBody').innerHTML = '<p class="admin-muted">No open items with that label.</p>';
    return;
  }

  $('inboxBody').innerHTML = filtered.map((i) => (
    '<article class="issue' + (i.state === 'closed' ? ' closed' : '') + '">'
    + '<div class="issue-top">'
    + '<a class="issue-title" href="' + esc(i.html_url) + '" target="_blank" rel="noopener">'
    + esc(i.title) + '</a>'
    + '<span class="issue-meta">#' + i.number + ' &middot; ' + esc(i.user?.login || 'unknown')
    + ' &middot; ' + when(i.created_at) + (i.state === 'closed' ? ' &middot; closed' : '') + '</span>'
    + '</div>'
    + (i.labelNames.length
      ? '<div class="issue-labels">' + i.labelNames.map((l) => '<span class="lbl l-' + esc(l)
        + '">' + esc(l) + '</span>').join('') + '</div>'
      : '<div class="issue-labels"><span class="lbl l-none">unlabelled</span></div>')
    + (i.body ? '<p class="issue-body">' + esc(i.body.slice(0, 260))
      + (i.body.length > 260 ? '&hellip;' : '') + '</p>' : '')
    + (i.labelNames.includes('review')
      ? '<button class="btn btn-sm" data-snippet="' + i.number + '">Copy as config entry</button>'
      : '')
    + '</article>'
  )).join('');
}

$('inboxBody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-snippet]');
  if (!btn) return;
  const issue = ISSUES.find((i) => String(i.number) === btn.dataset.snippet);
  if (!issue) return;
  try {
    await navigator.clipboard.writeText(reviewSnippet(issue));
    toast('Copied. Paste it into REVIEWS in js/config.js, then fill in role and place.');
  } catch {
    toast('Could not copy to the clipboard.');
  }
});

async function loadInbox() {
  if (!REPO_READY) {
    $('inboxBody').innerHTML = '<p class="admin-muted">No repository configured, so there is '
      + 'nowhere for feedback to arrive.</p>';
    $('inboxFilter').innerHTML = '';
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

    const counts = { all: ISSUES.length };
    LABELS.forEach((l) => { counts[l] = ISSUES.filter((i) => i.labelNames.includes(l)).length; });

    $('inboxFilter').innerHTML = ['all', ...LABELS].map((l) => (
      '<button type="button" class="' + (l === filter ? 'sel' : '') + '" data-f="' + l + '">'
      + l + ' <i>' + (counts[l] || 0) + '</i></button>'
    )).join('');
    renderInbox();
  } catch (err) {
    $('inboxBody').innerHTML = '<p class="admin-muted">Could not read GitHub: ' + esc(err.message)
      + '. The public API allows 60 requests an hour per address.</p>';
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

/* -------------------------------------------------------------------- boot */

async function refresh() {
  renderHealth();
  renderContent();
  renderIntegrity();
  await Promise.all([loadInbox(), loadTraffic()]);
}

$('btnRefresh').addEventListener('click', () => {
  refresh();
  toast('Refreshed.');
});

refresh();
