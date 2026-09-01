// Turns the profession packs into pages a search engine can read.
//
// The site had three indexable URLs and 41 professions' worth of genuinely
// specific advice - section order, what a recruiter checks first, what to put
// numbers on - all of it locked inside a JavaScript app. Nothing could rank,
// because from the outside there was nothing to rank.
//
// These are not doorway pages. Every one is built from that profession's own
// pack: nursing leads with registration numbers, engineering with latency and
// error rates, and a page with nothing particular to say does not get written.
//
// Static HTML on purpose. Google renders JavaScript, but it does it slowly and
// grudgingly, and a page whose served HTML is identical to twenty others is
// exactly the case where that goes wrong.
//
//   npm run build:pages

import { writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { PROFESSIONS } = await import('../public/js/professions.js');
const { SECTIONS } = await import('../public/js/schema.js');
const { hasSample } = await import('../public/js/samples.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'cv');
const SITE = 'https://ihatejob.app';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// "Healthcare / Nursing / Clinical" is the pack's name; a page title needs the
// bit a person would actually type.
const shortName = (name) => String(name).split('/')[0].trim();

const label = (p, key) => (p.labels && p.labels[key])
  || (SECTIONS[key] && SECTIONS[key].title)
  || key;

const list = (items) => '<ul>' + items.map((i) => '<li>' + i + '</li>').join('') + '</ul>';

const lengthLine = (pages) => {
  if (!Array.isArray(pages) || !pages.length) return '';
  const min = Math.min(...pages);
  const max = Math.max(...pages);
  if (min !== max) return min + ' to ' + max + ' pages is normal for this field.';
  return min === 1 ? 'One page is the norm here.' : min + ' pages is the norm here.';
};

const HEAD = (p, slug, description) => {
  const short = shortName(p.name);
  const title = short + ' CV: what to include, and in what order';
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | ihatejob</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}/cv/${slug}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/cv/${slug}">
<meta property="og:site_name" content="ihatejob">
<meta property="og:image" content="${SITE}/icons/icon-512.png">
<meta name="twitter:card" content="summary">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0e1116" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#eef1f6" media="(prefers-color-scheme: light)">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="stylesheet" href="/css/app.css">
<link rel="stylesheet" href="/css/site.css">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
{"@type":"ListItem","position":1,"name":"ihatejob","item":"${SITE}/"},
{"@type":"ListItem","position":2,"name":"CV formats by profession","item":"${SITE}/cv"},
{"@type":"ListItem","position":3,"name":${JSON.stringify(short + ' CV')}}]}
</script>
<script>
  try {
    var t = localStorage.getItem('ihatejob.theme');
    if (!t) t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
  } catch (e) { document.documentElement.dataset.theme = 'dark'; }
</script>`;
};

const NAV = `
<header class="site-nav">
  <a class="brand" href="/"><span>ihatejob<small>a CV worth leaving with</small></span></a>
  <nav class="nav-links">
    <a href="/#formats">Formats</a>
    <a href="/#professions">Professions</a>
    <a href="/#rating">Rating</a>
    <a href="/stories">Journeys</a>
  </nav>
  <div class="nav-actions">
    <a class="btn btn-primary nav-cta" href="/app">Open the builder</a>
  </div>
</header>`;

const FOOT = `
<footer class="site-foot">
  <div class="wrap foot-inner">
    <div><b>ihatejob</b><p>A CV builder that runs entirely in your browser. MIT licensed.</p></div>
    <nav>
      <a href="/app">Builder</a>
      <a href="/cv">All professions</a>
      <a href="/stories">Journeys</a>
      <a href="/#review">Leave a review</a>
    </nav>
  </div>
</footer>`;

function page(slug, p, siblings) {
  const short = shortName(p.name);
  // "custom" is a slot in the editor, not a section a reader has heard of.
  const order = (Array.isArray(p.order) ? p.order : []).filter((k) => k !== 'custom');
  const req = Array.isArray(p.require) ? p.require : [];
  const guidance = p.guidance || {};
  const wants = p.wants || {};

  const description = (req.length
    ? 'A ' + short.toLowerCase() + ' CV has to carry '
      + req.map((k) => label(p, k).toLowerCase()).join(', ') + '. '
    : '')
    + 'What to put first, what to quantify, and what gets a CV rejected in this field.';

  const body = [];

  body.push('<header class="blog-head"><h1>How to write a ' + esc(short) + ' CV</h1>'
    + '<p>The conventions below are the ones this field actually uses. They are what the '
    + 'builder applies when you pick <b>' + esc(p.name) + '</b>, and what the rating checks '
    + 'a finished CV against.</p></header>');

  if (req.length) {
    body.push('<h2>What it must contain</h2>'
      + '<p>Leave any of these out and the CV reads as incomplete to someone who hires in '
      + 'this field:</p>'
      + list(req.map((k) => '<b>' + esc(label(p, k)) + '</b>'
        + (guidance[k] ? ' &mdash; ' + esc(guidance[k]) : ''))));
  }

  if (order.length) {
    body.push('<h2>The order to put them in</h2>'
      + '<p>Order is not cosmetic. What sits at the top is what gets read before someone '
      + 'decides whether to keep reading.</p>'
      + '<ol>' + order.map((k) => '<li>' + esc(label(p, k)) + '</li>').join('') + '</ol>');
  }

  const extra = Object.keys(guidance).filter((k) => !req.includes(k));
  if (extra.length) {
    body.push('<h2>Section by section</h2>'
      + list(extra.map((k) => '<b>' + esc(label(p, k)) + '</b> &mdash; ' + esc(guidance[k]))));
  }

  if (Array.isArray(p.metrics) && p.metrics.length) {
    body.push('<h2>What to put numbers on</h2>'
      + '<p>The single most common reason a CV in this field reads as weak is that nothing '
      + 'in it is measured. These are the figures that mean something here:</p>'
      + '<p>' + p.metrics.map((m) => '<code>' + esc(m) + '</code>').join(' &middot; ') + '</p>');
  }

  if (Array.isArray(p.verbs) && p.verbs.length) {
    body.push('<h2>Verbs that carry weight</h2>'
      + '<p>Openers like &ldquo;responsible for&rdquo; and &ldquo;worked on&rdquo; describe a '
      + 'job description rather than a person. In this field these do the work instead:</p>'
      + '<p>' + p.verbs.map((v) => '<code>' + esc(v) + '</code>').join(' &middot; ') + '</p>');
  }

  const warnings = Object.values(wants).filter(Boolean);
  if (warnings.length) {
    body.push('<h2>What gets one rejected</h2>' + list(warnings.map(esc)));
  }

  const len = lengthLine(p.pages);
  if (len) body.push('<h2>Length</h2><p>' + esc(len) + '</p>');

  body.push('<div class="st-actions" style="margin:28px 0">'
    + '<a class="btn btn-primary btn-lg" href="/app?profession=' + esc(slug) + '">'
    + 'Build a ' + esc(short) + ' CV</a>'
    + (hasSample && hasSample(slug)
      ? '<a class="btn" href="/app?profession=' + esc(slug) + '">See a worked example</a>' : '')
    + '</div>');

  body.push('<p class="admin-muted">Free, no account, and nothing is uploaded &mdash; the '
    + 'builder runs in your browser and the CV never leaves it.</p>');

  if (siblings.length) {
    body.push('<h2>Related fields</h2>'
      + '<p>' + siblings.map(([s, q]) => '<a href="/cv/' + esc(s) + '">'
        + esc(shortName(q.name)) + '</a>').join(' &middot; ') + '</p>');
  }

  return HEAD(p, slug, description) + NAV
    + '<main class="blog-main"><div class="wrap"><article class="post">'
    + body.join('\n') + '</article></div></main>' + FOOT + '\n';
}

function indexPage(entries) {
  const groups = {};
  entries.forEach(([slug, p]) => {
    (groups[p.group || 'Other'] = groups[p.group || 'Other'] || []).push([slug, p]);
  });
  const description = 'CV conventions for ' + entries.length + ' professions: what each field '
    + 'expects first, what to quantify, and what gets a CV rejected.';

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CV formats by profession | ihatejob</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}/cv">
<meta property="og:title" content="CV formats by profession">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/cv">
<meta property="og:site_name" content="ihatejob">
<meta property="og:image" content="${SITE}/icons/icon-512.png">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/css/app.css">
<link rel="stylesheet" href="/css/site.css">
<script>
  try {
    var t = localStorage.getItem('ihatejob.theme');
    if (!t) t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
  } catch (e) { document.documentElement.dataset.theme = 'dark'; }
</script>` + NAV
    + '<main class="blog-main"><div class="wrap"><article class="post">'
    + '<header class="blog-head"><h1>CV formats by profession</h1>'
    + '<p>A CV that is right for a software engineer is wrong for a staff nurse. These are '
    + 'the conventions each field actually uses &mdash; what goes first, what has to be '
    + 'measured, and what gets one thrown out.</p></header>'
    + Object.keys(groups).sort().map((g) => '<h2>' + esc(g) + '</h2><p>'
      + groups[g].map(([s, p]) => '<a href="/cv/' + esc(s) + '">' + esc(shortName(p.name))
        + '</a>').join(' &middot; ') + '</p>').join('\n')
    + '</article></div></main>' + FOOT + '\n';
}

/* ------------------------------------------------------------------ run */

const entries = Object.entries(PROFESSIONS)
  // A pack with nothing particular to say would make a page with nothing
  // particular to say, and a thin page is worse than no page.
  .filter(([, p]) => (p.require || []).length || Object.keys(p.guidance || {}).length)
  .sort((a, b) => a[1].name.localeCompare(b[1].name));

await mkdir(OUT, { recursive: true });

// Clear out pages for professions that no longer exist.
for (const f of await readdir(OUT).catch(() => [])) {
  if (f.endsWith('.html')) await unlink(join(OUT, f));
}

for (const [slug, p] of entries) {
  const siblings = entries
    .filter(([s, q]) => s !== slug && q.group === p.group)
    .slice(0, 6);
  await writeFile(join(OUT, slug + '.html'), page(slug, p, siblings), 'utf8');
}
await writeFile(join(OUT, 'index.html'), indexPage(entries), 'utf8');

const urls = [
  ['/', '1.0'], ['/app', '0.9'], ['/cv', '0.8'], ['/stories', '0.6'],
  ...entries.map(([s]) => ['/cv/' + s, '0.7']),
];
await writeFile(join(ROOT, 'public', 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + urls.map(([u, pr]) => '  <url><loc>' + SITE + u + '</loc><priority>' + pr + '</priority></url>')
    .join('\n')
  + '\n</urlset>\n', 'utf8');

console.log('wrote ' + entries.length + ' profession pages + index, and '
  + (urls.length) + ' sitemap URLs');
const skipped = Object.keys(PROFESSIONS).length - entries.length;
if (skipped) console.log('skipped ' + skipped + ' pack(s) with too little to say');
