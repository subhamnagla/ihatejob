// The landing page. Everything it claims is derived from the app's own data,
// so the numbers on the front page cannot drift from what the builder does.

import { SITE } from './config.js';
import { initPWA } from './pwa.js';
import { PROFESSIONS, PROFESSION_GROUPS, ALIASES } from './professions.js';
import { TEMPLATES, renderCV, esc } from './templates.js';
import { buildSample } from './samples.js';
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

function paper(profId, accent, name) {
  const d = buildSample(profId);
  if (!d) return '';
  d.settings.accent = accent;
  if (name) {
    d.basics.fullName = name;
    // buildSample derives the address from the sample's own name, so it has
    // to be rebuilt too - otherwise the header shows one person over another
    // person's email. example.com either way: this is a specimen, and a real
    // address on a public page is an invitation to scrape it.
    const h = name.toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter(Boolean);
    d.basics.email = (h[0] || 'name') + '.' + (h[h.length - 1] || 'surname') + '@example.com';
  }
  const { html, classes } = renderCV(d);
  return '<div class="' + classes + ' paper" style="--accent:' + accent + '">' + html + '</div>';
}

// One document, not a pile. Two overlapping papers read as a stock image of
// "some CVs"; one legible page reads as the thing the site makes.
// Teal, not the brand blue. The accent was the same #2563eb as the buttons
// and links around it, so the one object the page is selling read as more
// chrome. It is also a nurse's CV, and teal is that world's colour.
$('heroArt').innerHTML = paper('software-engineering', '#057d74', 'Subham Nagla');

/* --------------------------------------------------- what it actually does */

// Six things the builder does, one at a time. The list is in the markup; this
// only moves the highlight. It stops while the pointer is on it, while the tab
// is in the background, and entirely if the visitor asked not to be moved at.
const feats = $('heroFeats');
if (feats) {
  const items = [...feats.children];
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let at = 0;
  let timer = null;

  const light = (n) => {
    items[at].classList.remove('on');
    at = (n + items.length) % items.length;
    items[at].classList.add('on');
  };
  const stop = () => { clearInterval(timer); timer = null; };
  const start = () => {
    stop();
    if (still.matches || document.hidden) return;
    timer = setInterval(() => light(at + 1), 3600);
  };

  items[0].classList.add('on');
  start();

  feats.addEventListener('pointerenter', stop);
  feats.addEventListener('pointerleave', start);
  document.addEventListener('visibilitychange', start);
  still.addEventListener('change', start);
}

/* --------------------------------------------------------------- formats */

const FORMAT_ACCENT = {
  classic: '#3465cc', minimal: '#334155', ats: '#111827', executive: '#057d74',
  modern: '#3465cc', creative: '#7252c3', academic: '#334155', federal: '#057d74',
};

// Four on the landing page. Eight thumbnails is a catalogue; the builder is
// where someone chooses, and it has all of them.
const SHOWN = ['classic', 'minimal', 'ats', 'modern'];

$('formatRail').innerHTML = Object.entries(TEMPLATES)
  .filter(([key]) => SHOWN.includes(key))
  .map(([key, t]) => {
  const d = buildSample('software-engineering');
  d.settings.template = key;
  d.settings.accent = FORMAT_ACCENT[key] || '#3465cc';
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

/* ------------------------------------------------- the review form itself */

// The rating is the planet, picked here rather than typed as a number. It is
// the one bit of this site people repeat to each other, so asking for it in
// its own words - "Mars", not "6/10" - is the whole point.

// The planet picker below drops "The " so the buttons read Mars, Jupiter,
// the Sun. It used to borrow this from the review cards, which have gone.
const short = (name) => String(name).replace('The ', '');

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

// Stamped when the page loads. api/submit rejects anything that arrives
// impossibly soon after, which is most bots and no people.
const OPENED_AT = Date.now();

// Sends to /api/submit, which emails it. No account, no GitHub, no sign-up
// page at the end of the effort.
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

  // Not configured here: fall back to the routes that need no server, so the
  // words someone just wrote are never simply lost.
  if (MAIL_READY) {
    window.location.href = 'mailto:' + SITE.contactEmail
      + '?subject=' + encodeURIComponent(title)
      + '&body=' + encodeURIComponent(body);
    return { ok: true };
  }
  try {
    await navigator.clipboard.writeText([title, '', body].join('\n'));
    toast('Copied to your clipboard. No inbox is set up here, so nothing was sent.');
  } catch {
    toast('Nothing was sent - no inbox is configured here.');
  }
  return { ok: false };
}

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
// The form lives in a <details> now, so the footer link has to open it before
// scrolling - otherwise the link lands on a closed summary and looks broken.
function openReviewForm(e) {
  const box = $('review');
  if (!box) return;
  if (e) e.preventDefault();
  box.open = true;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const first = $('planetPick').querySelector('.pp-pick');
  if (first) setTimeout(() => first.focus(), 300);
}

const footReview = $('footReview');
if (footReview) footReview.addEventListener('click', openReviewForm);

/* ------------------------------------------------------ report a problem */

const reportForm = $('reportForm');
if (reportForm) {
  reportForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const what = $('rpWhat').value.trim();
    if (!what) {
      $('rpNote').textContent = 'Say what happened, otherwise there is nothing to look at.';
      $('rpWhat').focus();
      return;
    }
    const where = $('rpWhere').value.trim();
    const btn = reportForm.querySelector('[type="submit"]');
    btn.disabled = true;
    $('rpNote').textContent = 'Sending...';
    const body = (where ? 'Where: ' + where + '\n\n' : '') + what;
    sendIssue('bug', where || 'Reported from the site', body, $('rpWebsite').value)
      .then((r) => {
        btn.disabled = false;
        $('rpNote').textContent = r.ok ? 'Sent. Thank you.' : (r.error || '');
        if (r.ok) reportForm.reset();
      });
  });
}

/* ---------------------------------------------------------------- share */

// Two ways out, because they fail on opposite devices. navigator.share opens
// the phone's own sheet and reaches every app the visitor has installed, but
// desktop browsers mostly do not have it. The network links work everywhere
// and always will, because they are just URLs.
const SHARE_TEXT = 'ihatejob - a free CV builder that rates your CV out of 100 and tells you '
  + 'the exact phrases letting it down. No account, nothing uploaded.';

const ICON = {
  whatsapp: 'M12.04 2A9.9 9.9 0 0 0 2.1 11.9c0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.9 9.9 0 0 0 4.74 1.2 9.9 9.9 0 0 0 9.9-9.9A9.9 9.9 0 0 0 12.04 2zm5.8 14.05c-.24.68-1.4 1.3-1.94 1.35-.5.05-.98.23-3.3-.69-2.77-1.09-4.53-3.92-4.67-4.1-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.27.55-.34.73-.34h.53c.17.01.4-.06.62.48.24.57.8 1.97.87 2.11.07.14.12.3.02.49-.1.18-.15.3-.29.46l-.43.48c-.14.14-.29.29-.12.57.17.28.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.29 1.41.28.14.45.12.61-.07.17-.2.71-.83.9-1.11.19-.28.38-.23.63-.14.25.09 1.6.76 1.87.9.27.14.46.2.53.32.07.11.07.66-.17 1.34z',
  linkedin: 'M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0zM3.3 8.4h3.4V21H3.3V8.4zm5.6 0h3.26v1.72h.05c.45-.86 1.56-1.77 3.21-1.77 3.43 0 4.06 2.26 4.06 5.2V21h-3.39v-6.1c0-1.46-.03-3.33-2.03-3.33-2.03 0-2.34 1.59-2.34 3.23V21H8.9V8.4z',
  x: 'M17.53 3h3.02l-6.6 7.54L21.75 21h-5.9l-4.62-6.04L5.94 21H2.92l7.06-8.07L2.5 3h6.05l4.18 5.52L17.53 3zm-1.06 16.2h1.67L7.62 4.71H5.83l10.64 14.49z',
  reddit: 'M22 12.07a2.18 2.18 0 0 0-3.68-1.58c-1.48-1.02-3.5-1.68-5.74-1.76l1.17-3.7 3.2.75a1.75 1.75 0 1 0 .2-1.15l-3.6-.85a.6.6 0 0 0-.71.4l-1.4 4.42c-2.4.03-4.56.7-6.13 1.77A2.18 2.18 0 0 0 2 12.07c0 .83.47 1.55 1.15 1.92-.03.2-.05.4-.05.6 0 3.11 3.98 5.71 8.9 5.71s8.9-2.6 8.9-5.71c0-.2-.02-.4-.05-.6A2.19 2.19 0 0 0 22 12.07zM7.4 13.6a1.4 1.4 0 1 1 2.8 0 1.4 1.4 0 0 1-2.8 0zm8.06 3.9c-.9.9-2.6.97-3.46.97-.86 0-2.56-.07-3.46-.97a.38.38 0 0 1 .53-.53c.57.57 1.78.77 2.93.77s2.36-.2 2.93-.77a.38.38 0 0 1 .53.53zm-.66-2.5a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8z',
  email: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1.5 2 7.5 5.25L19.5 7h-15zM20 8.9l-7.42 5.2a1 1 0 0 1-1.16 0L4 8.9V17h16V8.9z',
  share: 'M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1L8.7 8.6a3 3 0 1 0 0 6.8l6.47 3.6A3 3 0 1 0 18 16a3 3 0 0 0-2.13.9L9.4 13.3a3 3 0 0 0 0-2.6L15.87 7.1A3 3 0 0 0 18 8z',
  copy: 'M9 3h9a2 2 0 0 1 2 2v11h-2V5H9V3zM5 7h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 2v10h9V9H5z',
};

const svgIcon = (key) => '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"'
  + ' aria-hidden="true"><path d="' + ICON[key] + '"/></svg>';

const SHARE_TARGETS = [
  ['whatsapp', 'WhatsApp', (u, t) => 'https://wa.me/?text=' + encodeURIComponent(t + ' ' + u)],
  ['linkedin', 'LinkedIn', (u) => 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(u)],
  ['x', 'X', (u, t) => 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(t) + '&url=' + encodeURIComponent(u)],
  ['reddit', 'Reddit', (u, t) => 'https://reddit.com/submit?url=' + encodeURIComponent(u) + '&title=' + encodeURIComponent(t)],
  ['email', 'Email', (u, t) => 'mailto:?subject=' + encodeURIComponent('A CV tool worth a look')
    + '&body=' + encodeURIComponent(t + ' ' + u)],
];

const canShare = typeof navigator.share === 'function';

const shareRow = $('shareRow');
if (shareRow) {
  // The first button is the sheet where there is one and the clipboard where
  // there is not, so the row never offers a sheet it cannot open.
  shareRow.innerHTML = '<button class="share-btn native" type="button" data-share>'
    + svgIcon(canShare ? 'share' : 'copy')
    + '<span>' + (canShare ? 'Share' : 'Copy link') + '</span></button>'
    + SHARE_TARGETS.map(([key, name, fn]) => (
      '<a class="share-btn s-' + key + '" target="_blank" rel="noopener"'
      + ' href="' + esc(fn(SITE.url, SHARE_TEXT)) + '" aria-label="Share on ' + esc(name) + '">'
      + svgIcon(key) + '<span>' + esc(name) + '</span></a>'
    )).join('');
}

async function shareSite() {
  if (canShare) {
    try {
      await navigator.share({ title: 'ihatejob', text: SHARE_TEXT, url: SITE.url });
    } catch {
      // A dismissed sheet rejects. Someone changing their mind is not a
      // failure, so it must not fall through to copying the link at them.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(SITE.url);
    toast('Link copied.');
  } catch {
    toast('Could not copy - the address bar has it.');
  }
}

// Delegated: the footer button and the one in the mobile menu are the same
// action, and the row is built into innerHTML either way.
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-share]')) shareSite();
});
