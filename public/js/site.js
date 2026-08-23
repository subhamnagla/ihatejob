// The landing page. Everything it claims is derived from the app's own data,
// so the numbers on the front page cannot drift from what the builder does.

import { SITE, STATS, REVIEWS, MIN_REVIEWS } from './config.js';
import { initPWA } from './pwa.js';
import { PROFESSIONS, PROFESSION_GROUPS, REGIONS, ALIASES } from './professions.js';
import { TEMPLATES, renderCV, esc } from './templates.js';
import { buildSample } from './samples.js';
import { blankData } from './schema.js';
import { reviewCV } from './review.js';
import { PLANETS, planetSVG, starsFor, starRow } from './planets.js';

const $ = (id) => document.getElementById(id);

// Until SITE.repo points at a repository that exists, every "open an issue"
// link would land on a GitHub 404. Detect the placeholder and copy the text to
// the clipboard instead of sending someone to a dead page.
const REPO_READY = !/your-username|example\.com|^$/.test(SITE.repo);
const MAIL_READY = /.+@.+\..+/.test(SITE.contactEmail || '');
const CAN_RECEIVE = REPO_READY || MAIL_READY;

/* ---------------------------------------------------------------- theme */

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

/* ------------------------------------------------------------------ hero */

function paper(profId, accent, cls) {
  const d = buildSample(profId);
  if (!d) return '';
  d.settings.accent = accent;
  const { html, classes } = renderCV(d);
  return '<div class="' + classes + ' paper ' + (cls || '') + '" style="--accent:' + accent + '">'
    + html + '</div>';
}

$('heroArt').innerHTML = paper('healthcare-clinical', '#0f766e', 'back')
  + paper('software-engineering', '#2563eb');

/* ----------------------------------------------------------------- stats */

const FACTS = [
  { n: Object.keys(PROFESSIONS).length, label: 'profession packs' },
  { n: Object.keys(REGIONS).length, label: 'regional rule sets' },
  { n: Object.keys(TEMPLATES).length, label: 'CV formats' },
  { n: Object.keys(PROFESSIONS).length, label: 'worked sample CVs' },
];

function statCell(value, label, pending) {
  return '<div class="stat-cell' + (pending ? ' pending' : '') + '">'
    + '<b>' + esc(String(value)) + '</b><span>' + esc(label) + '</span></div>';
}

async function renderStats() {
  const grid = $('statGrid');
  grid.innerHTML = FACTS.map((f) => statCell(f.n, f.label)).join('');

  if (!STATS.endpoint) {
    // Guidance belongs in the console and the README, never on the page.
    console.info('[ihatejob] Visitor numbers are hidden: set STATS.endpoint in '
      + 'js/config.js to show them. They are never invented.');
    return;
  }

  try {
    const res = await fetch(STATS.endpoint, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = STATS.read(await res.json());

    const cells = [];
    const min = STATS.minVisitors || 0;
    const fmt = (v) => v.toLocaleString();

    if (typeof data.visitors === 'number' && data.visitors >= min) {
      cells.push(statCell(fmt(data.visitors), 'visitors'));
    }
    const rated = typeof data.cvsRated === 'number' ? data.cvsRated : data.pageviews;
    if (typeof rated === 'number' && rated >= min) {
      cells.push(statCell(fmt(rated), 'CVs rated'));
    }
    // Nothing to add yet? The strip simply keeps the four facts.
    if (cells.length) grid.insertAdjacentHTML('beforeend', cells.join(''));
  } catch (err) {
    console.warn('[ihatejob] Analytics endpoint unreachable, visitor numbers hidden:', err.message);
  }
}
renderStats();

/* --------------------------------------------------------------- formats */

const FORMAT_ACCENT = {
  classic: '#2563eb', minimal: '#334155', ats: '#111827', executive: '#0f766e',
  modern: '#2563eb', creative: '#7c3aed', academic: '#334155', federal: '#0f766e',
};

$('formatRail').innerHTML = Object.entries(TEMPLATES).map(([key, t]) => {
  const d = buildSample('software-engineering');
  d.settings.template = key;
  d.settings.accent = FORMAT_ACCENT[key] || '#2563eb';
  if (key === 'academic') d.settings.font = 'book';
  const { html, classes } = renderCV(d);
  // Not an <a>: the rendered CV contains its own project links, and nesting
  // anchors is invalid HTML - the parser closes the outer one and the caption
  // ends up outside the card.
  return '<div class="format-card" role="link" tabindex="0" data-href="/app"'
    + ' aria-label="' + esc(t.name) + ' format - open the builder">'
    + '<div class="format-frame"><div class="' + classes + '" style="--accent:'
    + d.settings.accent + '">' + html + '</div></div>'
    + '<b>' + esc(t.name) + '</b><span>' + esc(t.blurb) + '</span></div>';
}).join('');

$('formatRail').addEventListener('click', (e) => {
  const card = e.target.closest('[data-href]');
  if (card) location.href = card.dataset.href;
});
$('formatRail').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest('[data-href]');
  if (card) { e.preventDefault(); location.href = card.dataset.href; }
});

/* ----------------------------------------------------------- professions */

function renderProfessions(query) {
  const q = String(query || '').trim().toLowerCase();
  const groups = PROFESSION_GROUPS.map((g) => ({
    name: g.name,
    items: g.items.filter((p) => !q
      || p.name.toLowerCase().includes(q)
      || p.group.toLowerCase().includes(q)
      || (ALIASES[p.id] || []).some((a) => a.includes(q) || q.includes(a))
      || (p.metrics || []).some((m) => m.toLowerCase().includes(q))),
  })).filter((g) => g.items.length);

  if (!groups.length) {
    $('profGroups').innerHTML = '<p class="prof-empty">Nothing matches &ldquo;' + esc(query)
      + '&rdquo;. That is worth telling us &mdash; '
      + '<a href="#suggest">suggest the profession</a> and it can be added.</p>';
    return;
  }

  $('profGroups').innerHTML = groups.map((g) => (
    '<div class="prof-group"><h3>' + esc(g.name) + '</h3><div class="prof-chips">'
    + g.items.map((p) => (
      '<a class="prof-chip" href="/app?profession=' + encodeURIComponent(p.id) + '">'
      + esc(p.name) + '<i>' + p.pages[0]
      + (p.pages[1] !== p.pages[0] ? '-' + p.pages[1] : '') + 'p</i></a>'
    )).join('')
    + '</div></div>'
  )).join('');
}
renderProfessions('');
$('profSearch').addEventListener('input', (e) => renderProfessions(e.target.value));

/* ---------------------------------------------------------------- rating */

// Pull the six characters straight from the checker so the page cannot
// describe a rating the app no longer gives.
const bands = reviewCV(blankData(), { pages: 1 }).bands;
$('charGrid').innerHTML = bands.map((b) => (
  '<div class="char-tile"><span class="weight">' + b.max + ' pts</span>'
  + '<b>' + esc(b.name) + '</b><p>' + esc(b.blurb) + '</p></div>'
)).join('');

$('planetScaleStrip').innerHTML = PLANETS.map((p) => (
  '<div class="pp-item">' + planetSVG(p, 44) + '<span>' + esc(p.name.replace('The ', '')) + '</span></div>'
)).join('');

/* --------------------------------------------------------------- reviews */

const REVIEW_ISSUE = SITE.repo + '/issues/new?labels=review&title='
  + encodeURIComponent('Review: ')
  + '&body=' + encodeURIComponent([
    'What were you applying for?', '', '',
    'What did it score, and did that feel right?', '', '',
    'What helped, and what got in the way?', '', '',
    'May we quote you on the site? If so, how should we credit you (name, job title, city)?',
    '', '',
  ].join('\n'));

function renderReviews() {
  const section = $('reviews');
  const navLink = $('navReviews');

  // Below the threshold the section does not exist as far as a visitor is
  // concerned: no heading, no empty state, no nav link, no explanation.
  if (REVIEWS.length < MIN_REVIEWS) {
    section.hidden = true;
    if (navLink) navLink.hidden = true;
    console.info('[ihatejob] Reviews hidden: ' + REVIEWS.length + ' of '
      + MIN_REVIEWS + ' needed. Add real ones to REVIEWS in js/config.js.');
    return;
  }

  section.hidden = false;
  if (navLink) navLink.hidden = false;

  $('reviewArea').innerHTML = '<div class="review-grid">' + REVIEWS.map((r) => {
    const initials = String(r.name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
    return '<article class="review">'
      + '<blockquote>&ldquo;' + esc(r.quote) + '&rdquo;</blockquote>'
      + '<footer><span class="review-avatar">' + esc(initials.toUpperCase()) + '</span>'
      + '<span class="who"><b>' + esc(r.name) + '</b>'
      + '<span>' + esc([r.role, r.place].filter(Boolean).join(' · ')) + '</span></span>'
      + (r.source ? '<a href="' + esc(r.source) + '" target="_blank" rel="noopener">source</a>' : '')
      + '</footer></article>';
  }).join('') + '</div>';
}
renderReviews();

// Leaving a review must work whether or not the reviews section is showing -
// otherwise there is no way to ever reach the threshold that reveals it.
function openReviewForm(e) {
  if (e) e.preventDefault();
  if (REPO_READY) {
    window.open(REVIEW_ISSUE, '_blank', 'noopener');
    return;
  }
  const kind = $('sgKind');
  if (kind) kind.value = 'review';
  $('sgTitle').placeholder = 'e.g. Got a 62 as a nurse, the licence check caught something real';
  $('sgBody').placeholder = REVIEW_PROMPT;
  $('suggest').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => $('sgTitle').focus({ preventScroll: true }), 320);
  if (!CAN_RECEIVE) {
    toast('Write it here - note there is no inbox configured yet, so it will only be copied.');
  }
}

const REVIEW_PROMPT = [
  'What were you applying for?',
  'What did it score, and did that feel right?',
  'What helped, and what got in the way?',
  'May we quote you? If so, how should we credit you (name, job title, city)?',
].join('\n\n');

['footReview', 'btnLeaveReview'].forEach((id) => {
  const el = $(id);
  if (el) el.addEventListener('click', openReviewForm);
});

/* -------------------------------------------------------------- AI costs */

// Real per-call arithmetic, not a vague promise.
$('aiCost').innerHTML = '<b>Why there is no AI here yet.</b> Everything above is deterministic: '
  + 'the same CV always gets the same rating, it works offline, and it costs nothing to run. '
  + 'AI is worth adding for tailoring a CV to a job advert or rewriting weak openers &mdash; '
  + 'roughly $0.01 to $0.05 per CV &mdash; and when it lands it will be bring-your-own-key, so '
  + 'the tool stays free to run and free to self-host.';

/* ------------------------------------------------------------ open source */

const ISSUE = (labels, title, body) => SITE.repo + '/issues/new?labels=' + encodeURIComponent(labels)
  + '&title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);

// Delivery chain: the repository if it exists, then email, then an honest
// dead end. Never claim something was sent when there is nowhere to send it.
async function sendIssue(labels, title, body) {
  if (REPO_READY) {
    window.open(ISSUE(labels, title, body), '_blank', 'noopener');
    return;
  }
  if (MAIL_READY) {
    window.location.href = 'mailto:' + SITE.contactEmail
      + '?subject=' + encodeURIComponent(title)
      + '&body=' + encodeURIComponent(body);
    return;
  }
  try {
    await navigator.clipboard.writeText([title, '', body].join('\n'));
    toast('Copied to your clipboard. No inbox is set up yet, so nothing was sent.');
  } catch {
    toast('Nothing was sent - no repository or email address is configured yet.');
  }
}

// Anchors only navigate when there is somewhere real to go.
function wireIssueLink(el, labels, title, body) {
  if (!el) return;
  if (REPO_READY) {
    el.href = ISSUE(labels, title, body);
    el.target = '_blank';
    el.rel = 'noopener';
    return;
  }
  el.href = '#suggest';
  el.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('suggest').scrollIntoView({ behavior: 'smooth' });
    const kind = document.getElementById('sgKind');
    if (kind && [...kind.options].some((o) => o.value === labels)) kind.value = labels;
    toast('Tell us here - the public repository is not live yet.');
  });
}

const Q = (...parts) => parts.join('\n');

wireIssueLink($('osRepo'), 'profession', 'New profession: ', Q(
  'Which profession?', '', '',
  "How do you know this field's conventions?", '', '',
  'What order should the sections be in?', '', '',
  'What must a CV in this field always include?', '', '',
  'What does a strong CV here quantify?', '', '',
  'Typical length?', '', ''));

wireIssueLink($('osRegion'), 'region', 'Region rules: ', Q(
  'Which country or region?', '', '',
  'Is a photo expected, accepted, or disqualifying?', '', '',
  'Are personal details (date of birth, marital status) expected or forbidden?', '', '',
  'Typical length and date format?', '', '',
  'Source, if you have one?', '', ''));

wireIssueLink($('osTemplate'), 'template', 'New format: ', Q(
  'What does it look like?', '', '',
  'Single column or sidebar?', '', '',
  'Who is it for?', '', ''));

const KIND = {
  review: ['review', 'Review: '],
  profession: ['profession', 'New profession: '],
  region: ['region', 'Region rules: '],
  template: ['template', 'New format: '],
  checker: ['checker', 'Checker rule: '],
  bug: ['bug', 'Bug: '],
  idea: ['enhancement', 'Idea: '],
};

$('suggestForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!$('sgTitle').value.trim()) {
    $('sgNote').textContent = 'Add a one-line summary first.';
    return;
  }
  $('sgNote').textContent = '';
  const kind = $('sgKind').value;
  const [label, prefix] = KIND[kind] || KIND.idea;
  sendIssue(label, prefix + $('sgTitle').value.trim(), $('sgBody').value.trim());
});

$('sgCopy').addEventListener('click', async () => {
  const text = 'Kind: ' + $('sgKind').value + '\nSummary: ' + $('sgTitle').value
    + '\n\n' + $('sgBody').value;
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied. Paste it wherever suits you.');
  } catch {
    $('sgNote').textContent = 'Could not copy - select the text and copy it manually.';
  }
});

/* ----------------------------------------------------------------- share */

const SHARE_URL = SITE.url;
const SHARE_TEXT = 'ihatejob - a free CV builder that rates your CV out of 100 and tells you '
  + 'the exact phrases letting it down. No account, nothing uploaded.';

$('shareUrl').value = SHARE_URL;

const ICON = {
  whatsapp: 'M12.04 2A9.9 9.9 0 0 0 2.1 11.9c0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.9 9.9 0 0 0 4.74 1.2 9.9 9.9 0 0 0 9.9-9.9A9.9 9.9 0 0 0 12.04 2zm5.8 14.05c-.24.68-1.4 1.3-1.94 1.35-.5.05-.98.23-3.3-.69-2.77-1.09-4.53-3.92-4.67-4.1-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.27.55-.34.73-.34h.53c.17.01.4-.06.62.48.24.57.8 1.97.87 2.11.07.14.12.3.02.49-.1.18-.15.3-.29.46l-.43.48c-.14.14-.29.29-.12.57.17.28.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.29 1.41.28.14.45.12.61-.07.17-.2.71-.83.9-1.11.19-.28.38-.23.63-.14.25.09 1.6.76 1.87.9.27.14.46.2.53.32.07.11.07.66-.17 1.34z',
  linkedin: 'M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0zM3.3 8.4h3.4V21H3.3V8.4zm5.6 0h3.26v1.72h.05c.45-.86 1.56-1.77 3.21-1.77 3.43 0 4.06 2.26 4.06 5.2V21h-3.39v-6.1c0-1.46-.03-3.33-2.03-3.33-2.03 0-2.34 1.59-2.34 3.23V21H8.9V8.4z',
  x: 'M17.53 3h3.02l-6.6 7.54L21.75 21h-5.9l-4.62-6.04L5.94 21H2.92l7.06-8.07L2.5 3h6.05l4.18 5.52L17.53 3zm-1.06 16.2h1.67L7.62 4.71H5.83l10.64 14.49z',
  reddit: 'M22 12.07a2.18 2.18 0 0 0-3.68-1.58c-1.48-1.02-3.5-1.68-5.74-1.76l1.17-3.7 3.2.75a1.75 1.75 0 1 0 .2-1.15l-3.6-.85a.6.6 0 0 0-.71.4l-1.4 4.42c-2.4.03-4.56.7-6.13 1.77A2.18 2.18 0 0 0 2 12.07c0 .83.47 1.55 1.15 1.92-.03.2-.05.4-.05.6 0 3.11 3.98 5.71 8.9 5.71s8.9-2.6 8.9-5.71c0-.2-.02-.4-.05-.6A2.19 2.19 0 0 0 22 12.07zM7.4 13.6a1.4 1.4 0 1 1 2.8 0 1.4 1.4 0 0 1-2.8 0zm8.06 3.9c-.9.9-2.6.97-3.46.97-.86 0-2.56-.07-3.46-.97a.38.38 0 0 1 .53-.53c.57.57 1.78.77 2.93.77s2.36-.2 2.93-.77a.38.38 0 0 1 .53.53zm-.66-2.5a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8z',
  email: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1.5 2 7.5 5.25L19.5 7h-15zM20 8.9l-7.42 5.2a1 1 0 0 1-1.16 0L4 8.9V17h16V8.9z',
  share: 'M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1L8.7 8.6a3 3 0 1 0 0 6.8l6.47 3.6A3 3 0 1 0 18 16a3 3 0 0 0-2.13.9L9.4 13.3a3 3 0 0 0 0-2.6L15.87 7.1A3 3 0 0 0 18 8z',
  copy: 'M9 3h9a2 2 0 0 1 2 2v11h-2V5H9V3zM5 7h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 2v10h9V9H5z',
};

const svg = (key) => '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"'
  + ' aria-hidden="true"><path d="' + ICON[key] + '"/></svg>';

const SHARE_TARGETS = [
  ['whatsapp', 'WhatsApp', (u, t) => 'https://wa.me/?text=' + encodeURIComponent(t + ' ' + u)],
  ['linkedin', 'LinkedIn', (u) => 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(u)],
  ['x', 'X', (u, t) => 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(t) + '&url=' + encodeURIComponent(u)],
  ['reddit', 'Reddit', (u, t) => 'https://reddit.com/submit?url=' + encodeURIComponent(u) + '&title=' + encodeURIComponent(t)],
  ['email', 'Email', (u, t) => 'mailto:?subject=' + encodeURIComponent('A CV tool worth a look')
    + '&body=' + encodeURIComponent(t + ' ' + u)],
];

async function nativeShare() {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'ihatejob', text: SHARE_TEXT, url: SHARE_URL });
      return true;
    } catch { return true; } // the user dismissed the sheet; not an error
  }
  return false;
}

$('shareRow').innerHTML =
  (navigator.share
    ? '<button class="share-btn native" type="button" id="btnNativeShare">'
      + svg('share') + '<span>Share</span></button>'
    : '')
  + SHARE_TARGETS.map(([key, name, fn]) => (
    '<a class="share-btn s-' + key + '" target="_blank" rel="noopener"'
    + ' href="' + esc(fn(SHARE_URL, SHARE_TEXT)) + '" aria-label="Share on ' + esc(name) + '">'
    + svg(key) + '<span>' + esc(name) + '</span></a>'
  )).join('');

const nativeBtn = $('btnNativeShare');
if (nativeBtn) nativeBtn.addEventListener('click', nativeShare);

$('btnShareTop').addEventListener('click', async () => {
  if (await nativeShare()) return;
  document.getElementById('share').scrollIntoView({ behavior: 'smooth' });
});

$('btnCopyUrl').innerHTML = svg('copy') + '<span>Copy link</span>';
$('btnCopyUrl').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(SHARE_URL);
    toast('Link copied.');
  } catch {
    $('shareUrl').select();
    toast('Press Ctrl+C to copy.');
  }
});

initPWA({ onToast: toast });
