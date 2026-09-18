// The landing page. Everything it claims is derived from the app's own data,
// so the numbers on the front page cannot drift from what the builder does.

import { SITE } from './config.js';
import { initPWA } from './pwa.js';
import { PROFESSIONS, PROFESSION_GROUPS, ALIASES } from './professions.js';
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

// One document, not a pile. Two overlapping papers read as a stock image of
// "some CVs"; one legible page reads as the thing the site makes.
$('heroArt').innerHTML = paper('healthcare-clinical', '#2563eb');

/* --------------------------------------------------------------- formats */

const FORMAT_ACCENT = {
  classic: '#2563eb', minimal: '#334155', ats: '#111827', executive: '#0f766e',
  modern: '#2563eb', creative: '#7c3aed', academic: '#334155', federal: '#0f766e',
};

// Four on the landing page. Eight thumbnails is a catalogue; the builder is
// where someone chooses, and it has all of them.
const SHOWN = ['classic', 'minimal', 'ats', 'modern'];

$('formatRail').innerHTML = Object.entries(TEMPLATES)
  .filter(([key]) => SHOWN.includes(key))
  .map(([key, t]) => {
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

/* ------------------------------------------------------------ share link */

// The share band - five network buttons, an install card and a second "leave
// a review" - has gone. What is worth keeping for a free tool is the ability
// to pass the link on, and that is one button.
const copyIcon = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"'
  + ' aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2'
  + ' 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>';

$('btnCopyUrl').innerHTML = copyIcon + '<span>Copy link</span>';
$('btnCopyUrl').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(SITE.url);
    toast('Link copied.');
  } catch {
    toast('Could not copy - the address bar has it.');
  }
});
