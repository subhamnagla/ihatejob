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

// Submissions go to /api/submit, which emails them. contactEmail is only the
// fallback for when that endpoint is not deployed - local dev, or before the
// environment variables are set.
const MAIL_READY = /.+@.+\..+/.test(SITE.contactEmail || '');

/* ---------------------------------------------------------------- theme */

$('btnTheme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('ihatejob.theme', next); } catch { /* private mode */ }
});

/* ------------------------------------------------------------ mobile nav */

// Below 900px the horizontal links are hidden by CSS, which left a phone with
// a nav bar containing no navigation. This is that navigation.
const navSheet = $('navSheet');
const navToggle = $('navToggle');

function setNav(open) {
  navSheet.hidden = !open;
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  navToggle.classList.toggle('open', open);
}

navToggle.addEventListener('click', () => setNav(navSheet.hidden));
// Tapping a link jumps within the same page, so nothing else would close it.
navSheet.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
document.addEventListener('click', (e) => {
  if (!navSheet.hidden && !e.target.closest('#navSheet, #navToggle')) setNav(false);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

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

// A review carries a planet rank (1-10). Stars are derived from it rather than
// stored beside it, so the two can never drift apart - half a star per rung,
// the same arithmetic the checker uses on a CV.
const short = (name) => String(name).replace('The ', '');

function rankOf(r) {
  const rank = Number(r.planet);
  if (rank >= 1 && rank <= 10) return Math.round(rank);
  const legacy = Number(r.rating);          // entries written before the scale
  if (legacy >= 1 && legacy <= 5) return Math.round(legacy * 2);
  return 10;
}
const starsOf = (r) => Math.max(1, Math.round(rankOf(r) / 2));

const planetChip = (rank) => {
  const p = PLANETS[rank - 1];
  if (!p) return '';
  return '<span class="rv-planet" title="' + esc(p.name + ' - ' + p.tag) + '">'
    + planetSVG(p, 17) + esc(short(p.name)) + '</span>';
};

const stars = (n) => {
  let out = '<div class="rv-stars" aria-label="' + n + ' out of 5">';
  for (let i = 1; i <= 5; i += 1) {
    out += '<svg viewBox="0 0 24 24" width="16" height="16" class="' + (i <= n ? 'on' : 'off') + '">'
      + '<path fill="currentColor" d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45'
      + 'l-5.81 3.05 1.11-6.47L2.6 9.45l6.5-.95z"/></svg>';
  }
  return out + '</div>';
};

const initials = (name) => String(name || '?')
  .replace(/[^\p{L}\s]/gu, '')
  .trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('')
  .toUpperCase() || '?';

// A stable colour per person, so the same name always gets the same avatar.
const avatarHue = (name) => {
  let h = 0;
  for (let i = 0; i < String(name).length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
};

const LONG = 165;   // characters before a quote gets a "Read more"

function reviewCard(r) {
  const quote = String(r.quote || '');
  const long = quote.length > LONG;
  const head = long ? quote.slice(0, quote.lastIndexOf(' ', LONG)) : quote;

  return '<article class="rv">'
    + '<div class="rv-top">' + stars(starsOf(r)) + planetChip(rankOf(r)) + '</div>'
    + '<blockquote class="rv-quote' + (long ? ' clipped' : '') + '">'
    + '<span class="rv-head">&ldquo;' + esc(head) + (long ? '' : '&rdquo;') + '</span>'
    + (long ? '<span class="rv-rest">' + esc(quote.slice(head.length)) + '&rdquo;</span>' : '')
    + '</blockquote>'
    + (long ? '<button class="rv-more" type="button">Read more'
      + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"'
      + ' stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M6 9l6 6 6-6"/></svg></button>' : '')
    + '<footer class="rv-by">'
    + '<span class="rv-avatar" style="--hue:' + avatarHue(r.name || '') + '">'
    + esc(initials(r.name)) + '</span>'
    + '<span class="rv-who"><b>' + esc(r.name || 'Anonymous') + '</b>'
    + '<span>' + esc([r.role, r.place].filter(Boolean).join(' · ') || r.handle || '') + '</span>'
    + '</span>'
    + (r.source ? '<a class="rv-src" href="' + esc(r.source) + '" target="_blank" rel="noopener"'
      + ' aria-label="See the original">&#8599;</a>' : '')
    + '</footer></article>';
}

async function renderReviews() {
  const section = $('reviews');
  const navLinks = [$('navReviews'), $('navSheetReviews')].filter(Boolean);

  let items = [];
  try {
    const res = await fetch('/data/reviews.json', { cache: 'no-cache' });
    if (res.ok) items = await res.json();
  } catch { /* falls through to the config list */ }
  if (!Array.isArray(items) || !items.length) items = REVIEWS;

  // Hidden ones never reach the page; pinned ones lead.
  const live = items
    .filter((r) => !r.hidden && String(r.quote || '').trim())
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  if (live.length < MIN_REVIEWS) {
    section.hidden = true;
    navLinks.forEach((a) => { a.hidden = true; });
    console.info('[ihatejob] Reviews hidden: ' + live.length + ' of ' + MIN_REVIEWS
      + ' needed. Add them in the admin, or to REVIEWS in js/config.js.');
    return;
  }

  section.hidden = false;
  navLinks.forEach((a) => { a.hidden = false; });
  $('reviewArea').innerHTML = '<div class="rv-grid">' + live.map(reviewCard).join('') + '</div>';
}
renderReviews();

// Expanding a quote is per-card, so one long review does not push the rest around.
$('reviewArea').addEventListener('click', (e) => {
  const btn = e.target.closest('.rv-more');
  if (!btn) return;
  const card = btn.closest('.rv');
  const open = card.classList.toggle('open');
  card.querySelector('.rv-quote').classList.toggle('clipped', !open);
  btn.firstChild.textContent = open ? 'Show less' : 'Read more';
});

/* -------------------------------------------------------------- journeys */

// A teaser for /stories. Shows the three most recent, or the invitation on its
// own - which is not the same call as the reviews section, where an empty
// shelf would be advertising an absence rather than asking for something.
async function renderJourneys() {
  let items = [];
  try {
    const res = await fetch('/data/stories.json', { cache: 'no-cache' });
    if (res.ok) items = await res.json();
  } catch { /* the invitation shows on its own */ }

  const live = (Array.isArray(items) ? items : [])
    .filter((s) => s.published && s.slug && s.title)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 3);

  const cta = '<div class="jn-cta">'
    + '<a class="btn btn-primary" href="/stories#share-yours">Share your journey</a>'
    + '<a class="btn" href="/stories">Read all of them</a></div>';

  if (!live.length) {
    $('journeyArea').innerHTML = '<div class="st-empty"><b>Nobody has written one yet.</b>'
      + '<p>Yours would be the first. However it went &mdash; the eleven-month ones are worth '
      + 'more to the next person than the quick ones.</p></div>' + cta;
    return;
  }

  $('journeyArea').innerHTML = '<div class="jn-grid">' + live.map((s) => (
    '<a class="post-card st-card" href="/stories/' + encodeURIComponent(s.slug) + '">'
    + (s.outcome ? '<span class="st-outcome">' + esc(s.outcome) + '</span>' : '')
    + '<h3>' + esc(s.title) + '</h3>'
    + (s.excerpt ? '<p>' + esc(s.excerpt) + '</p>' : '')
    + '<span class="post-go">' + esc(s.name || 'Anonymous') + ' &rarr;</span>'
    + '</a>'
  )).join('') + '</div>' + cta;
}
renderJourneys();

/* ------------------------------------------------- the review form itself */

// The rating is the planet, picked here rather than typed as a number. It is
// the one bit of this site people repeat to each other, so asking for it in
// its own words - "Mars", not "6/10" - is the whole point.

let picked = 0;

$('planetPick').innerHTML = PLANETS.map((p) => (
  '<button class="pp-pick" type="button" role="radio" aria-checked="false"'
  + ' tabindex="' + (p.rank === 1 ? '0' : '-1') + '" data-rank="' + p.rank + '"'
  + ' aria-label="' + esc(p.name + ' - ' + p.tag) + '">'
  + planetSVG(p, 40)
  + '<span>' + esc(short(p.name)) + '</span></button>'
)).join('');

function setPicked(rank) {
  picked = rank;
  const p = PLANETS[rank - 1];
  $('planetPick').querySelectorAll('[data-rank]').forEach((b) => {
    const on = Number(b.dataset.rank) === rank;
    b.classList.toggle('sel', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  });
  $('planetRead').innerHTML = '<b>' + esc(p.name) + '</b> &mdash; ' + esc(p.tag)
    + starRow(starsFor(p.rank), 15);
  $('rvNote').textContent = '';
}

$('planetPick').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-rank]');
  if (btn) setPicked(Number(btn.dataset.rank));
});

// A radiogroup that only responds to a mouse is not a radiogroup.
$('planetPick').addEventListener('keydown', (e) => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step) return;
  e.preventDefault();
  setPicked(Math.min(10, Math.max(1, (picked || 1) + step)));
  const el = $('planetPick').querySelector('[data-rank="' + picked + '"]');
  if (el) el.focus();
});

function reviewText() {
  const p = PLANETS[picked - 1];
  const credit = [$('rvName').value.trim(), $('rvRole').value.trim()].filter(Boolean).join(' - ');
  return [
    'Rating: ' + p.name + ' (' + p.rank + ' of 10, ' + starsFor(p.rank) + ' stars)',
    'Credit: ' + (credit || 'anonymous'),
    'May be quoted on the site: ' + ($('rvConsent').checked ? 'yes' : 'no'),
    '',
    $('rvText').value.trim(),
  ].join('\n');
}

// Both buttons need the same two checks, and the same message when they fail.
function reviewReady() {
  if (!picked) {
    $('rvNote').textContent = 'Pick a planet first - that is the rating.';
    $('planetPick').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  if (!$('rvText').value.trim()) {
    $('rvNote').textContent = 'Add a line or two, otherwise there is nothing to publish.';
    $('rvText').focus();
    return false;
  }
  $('rvNote').textContent = '';
  return true;
}

$('reviewForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!reviewReady()) return;
  const p = PLANETS[picked - 1];
  const who = $('rvName').value.trim();
  const btn = $('reviewForm').querySelector('[type="submit"]');
  btn.disabled = true;
  sendIssue('review', p.name + (who ? ' - ' + who : ''), reviewText(), $('rvWebsite').value)
    .then((r) => {
      btn.disabled = false;
      if (r.ok) $('reviewForm').reset();
      else if (r.error) $('rvNote').textContent = r.error;
    });
});

$('rvCopy').addEventListener('click', async () => {
  if (!reviewReady()) return;
  try {
    await navigator.clipboard.writeText(reviewText());
    toast('Copied. Paste it wherever suits you.');
  } catch {
    $('rvNote').textContent = 'Could not copy - select the text and copy it manually.';
  }
});

// Leaving a review must work whether or not the reviews section is showing -
// otherwise there is no way to ever reach the threshold that reveals it.
function openReviewForm(e) {
  if (e) e.preventDefault();
  $('review').scrollIntoView({ behavior: 'smooth' });
}

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

// When the page was opened. The endpoint rejects anything submitted within a
// few seconds of it, which no person manages and every bot does.
const OPENED_AT = Date.now();

/**
 * Delivery chain, in order of how little it asks of the visitor:
 *
 *   1. POST to /api/submit, which emails it to the site owner. No account, no
 *      sign-up, no leaving the page. This is the whole point - asking someone
 *      to register somewhere to say "this helped" loses almost all of them,
 *      and keeps only the unrepresentative few.
 *   2. Email, then the clipboard, then an honest dead end.
 *
 * Nothing here sends anyone to GitHub. A visitor with something to say should
 * never meet a sign-up page on the way to saying it.
 *
 * Never claim something was sent when there was nowhere to send it.
 */
async function sendIssue(kind, title, body, honeypot) {
  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind, title, body, website: honeypot || '', startedAt: OPENED_AT,
      }),
    });
    // A non-JSON reply means the function is not running here at all.
    const type = res.headers.get('content-type') || '';
    if (type.includes('application/json')) {
      const out = await res.json();
      if (res.ok && out.ok) {
        toast('Sent. Thank you - it reaches us directly, no account needed.');
        return { ok: true };
      }
      if (res.status !== 503) return { ok: false, error: out.error || 'That could not be sent.' };
    }
  } catch { /* offline, or the endpoint is absent - fall through */ }

  // Not configured here: fall back to the routes that need no server.
  if (MAIL_READY) {
    window.location.href = 'mailto:' + SITE.contactEmail
      + '?subject=' + encodeURIComponent(title)
      + '&body=' + encodeURIComponent(body);
    return { ok: true };
  }
  try {
    await navigator.clipboard.writeText([title, '', body].join('\n'));
    toast('Copied to your clipboard. No inbox is set up yet, so nothing was sent.');
  } catch {
    toast('Nothing was sent - no inbox is configured yet.');
  }
  return { ok: false };
}

// These used to open a pre-filled GitHub issue, which meant a sign-up page for
// anyone without an account. They now fill in the form already on this page:
// same questions, same prompts, nowhere to be sent.
function wireIssueLink(el, labels, title, body) {
  if (!el) return;
  el.href = '#suggest';
  el.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('suggest').scrollIntoView({ behavior: 'smooth' });
    const kind = document.getElementById('sgKind');
    if (kind && [...kind.options].some((o) => o.value === labels)) kind.value = labels;
    // Only prefill an empty form - never overwrite something half-written.
    const sgTitle = document.getElementById('sgTitle');
    const sgBody = document.getElementById('sgBody');
    if (sgBody && !sgBody.value.trim()) sgBody.value = body;
    if (sgTitle && !sgTitle.value.trim()) sgTitle.placeholder = title.replace(/:\s*$/, '');
    if (sgTitle) sgTitle.focus();
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

$('suggestForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!$('sgTitle').value.trim()) {
    $('sgNote').textContent = 'Add a one-line summary first.';
    return;
  }
  if ($('sgBody').value.trim().length < 12) {
    $('sgNote').textContent = 'Add a little more detail so it is actionable.';
    return;
  }
  $('sgNote').textContent = '';
  const btn = $('suggestForm').querySelector('[type="submit"]');
  btn.disabled = true;
  sendIssue($('sgKind').value, $('sgTitle').value.trim(), $('sgBody').value.trim(),
    $('sgWebsite').value).then((r) => {
    btn.disabled = false;
    if (r.ok) $('suggestForm').reset();
    else if (r.error) $('sgNote').textContent = r.error;
  });
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
