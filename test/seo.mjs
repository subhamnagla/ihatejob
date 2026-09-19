// Structured data has to describe the page it is on.
//
// The FAQPage markup was written before the questions were. That is a thing
// Google asks you not to do in as many words - the content a graph describes
// must be visible to the person reading the page - and it is the right rule
// for a reason that has nothing to do with Google: markup for a question the
// page never asks is a claim about a page that does not exist.
//
// Eight answers on the home page, four on the ATS explainer and five on each
// of 41 profession pages is more text than anyone will re-check by hand after
// editing one of them. So this walks every HTML file the site serves, reads
// whatever FAQPage graphs it carries, and insists each question and each
// answer is really there in the body.
//
// It also holds the rest of the per-page metadata to a floor, because those
// are the other things that are silently wrong for months: a page with no
// canonical, two pages sharing a title, a graph that stopped parsing.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public');
const NL = String.fromCharCode(10);

let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    fails += 1;
    console.log('FAIL  ' + label + NL + '        want ' + JSON.stringify(want)
      + NL + '        got  ' + JSON.stringify(got));
  } else console.log('ok    ' + label);
};

async function htmlFiles() {
  const out = [];
  for (const name of await readdir(ROOT)) {
    if (name.endsWith('.html')) out.push(name);
  }
  for (const name of await readdir(join(ROOT, 'cv'))) {
    if (name.endsWith('.html')) out.push('cv/' + name);
  }
  return out.sort();
}

// The page as a reader meets it: no tags, no script or style contents, and
// entities resolved, so "&amp;" in the source and "&" in a JSON string are
// recognised as the same character rather than reported as a mismatch.
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&middot;/g, '·')
    .replace(/&rarr;/g, '→')
    .replace(/&bull;/g, '•')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const norm = (s) => String(s)
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/\s+/g, ' ')
  .trim();

function graphs(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { out.push(JSON.parse(m[1])); } catch (e) { out.push({ __bad: e.message }); }
  }
  return out;
}

const files = await htmlFiles();
const pages = [];
for (const name of files) {
  const html = await readFile(join(ROOT, name), 'utf8');
  pages.push({ name, html, text: visibleText(html), ld: graphs(html) });
}

console.log('=== every page carries the metadata a result needs ===');
check('there are pages to check', pages.length > 40, true);

const bad = pages.filter((p) => p.ld.some((g) => g.__bad));
check('every JSON-LD block parses', bad.map((p) => p.name), []);

// admin is the one page that must not be indexed, so it is held to the
// opposite standard and excused from the rest.
const admin = pages.find((p) => p.name === 'admin.html');
check('the admin page says noindex', /noindex/.test(admin.html), true);

// Google's verification file ends in .html and is not a page: 53 bytes of a
// token Google compares byte for byte. Giving it a title would un-verify the
// site, so it is excused rather than fixed.
const VERIFY = /^google[0-9a-f]+\.html$/;
const verify = pages.filter((p) => VERIFY.test(p.name));
check('the verification file is still there', verify.length, 1);
check('and is still only the token',
  verify[0].html.trim(), 'google-site-verification: ' + verify[0].name);

const indexable = pages.filter((p) => p.name !== 'admin.html' && !VERIFY.test(p.name));

const missing = (re) => indexable.filter((p) => !re.test(p.html)).map((p) => p.name);
check('every page has a title', missing(/<title>[^<]{10,}<\/title>/), []);
check('every page has a description', missing(/<meta name="description" content="[^"]{50,}"/), []);
check('every page has a canonical', missing(/<link rel="canonical" href="https:\/\/ihatejob\.app/), []);
check('every page has an og:title', missing(/<meta property="og:title"/), []);

// Two pages sharing a title is two pages competing for the same result, and
// the loser is usually the one that mattered.
const titles = indexable.map((p) => (p.html.match(/<title>([^<]*)<\/title>/) || [])[1]);
const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
check('no two pages share a title', [...new Set(dupes)], []);

const canons = indexable.map((p) => (p.html.match(/rel="canonical" href="([^"]+)"/) || [])[1]);
const dupeCanon = canons.filter((c, i) => canons.indexOf(c) !== i);
check('no two pages claim the same canonical', [...new Set(dupeCanon)], []);

console.log(NL + '=== a marked-up question is a question the page asks ===');

let asked = 0;
const unasked = [];
const unanswered = [];
for (const page of pages) {
  for (const g of page.ld) {
    if (g['@type'] !== 'FAQPage') continue;
    for (const q of g.mainEntity || []) {
      asked += 1;
      const name = norm(q.name);
      const text = norm(q.acceptedAnswer && q.acceptedAnswer.text);
      if (!norm(page.text).includes(name)) unasked.push(page.name + ': ' + name);
      if (!norm(page.text).includes(text)) {
        unanswered.push(page.name + ': ' + text.slice(0, 60) + '...');
      }
    }
  }
}

check('there is a FAQ to check at all', asked > 200, true);
check('every marked-up question appears on the page', unasked.slice(0, 5), []);
check('every marked-up answer appears on the page', unanswered.slice(0, 5), []);

// The home page and the ATS explainer are hand-written, so they are the two
// that can drift. Named here so a failure says which file to open.
for (const name of ['index.html', 'ats.html']) {
  const page = pages.find((p) => p.name === name);
  const faq = page.ld.find((g) => g['@type'] === 'FAQPage');
  check(name + ' still carries its FAQ', Boolean(faq && faq.mainEntity.length), true);
  check('  and renders the same number of them',
    (page.html.match(/<details class="faq-item"/g) || []).length,
    faq ? faq.mainEntity.length : 0);
}

console.log(NL + '=== every link lands somewhere ===');

// A dead fragment does not 404. "/#professions" after that section is gone
// drops the reader silently at the top of the home page, which is the kind of
// broken nobody reports and nobody notices for months. Four of these were
// live across 44 pages after the home page was rebuilt, in the nav and the
// footer of every one of them.
const home = pages.find((p) => p.name === 'index.html');

// Ids come from the markup and from the script the page loads, because some
// sections are rendered at runtime: /stories builds its own #share-yours.
// The id exists, just not in the file, and a test that cannot tell the
// difference teaches people to delete working links.
const scriptCache = new Map();
async function scriptsFor(html) {
  let out = '';
  for (const m of html.matchAll(/<script[^>]+src="(\/js\/[^"]+)"/g)) {
    const name = m[1].replace(/^\//, '');
    if (!scriptCache.has(name)) {
      scriptCache.set(name, await readFile(join(ROOT, name), 'utf8').catch(() => ''));
    }
    out += scriptCache.get(name);
  }
  return out;
}
const idsIn = (text) => new Set(
  [...text.matchAll(/(?:^|[\s>;'"`])id="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]),
);
for (const page of pages) page.ids = idsIn(page.html + (await scriptsFor(page.html)));
const homeIds = home.ids;

const dead = [];
for (const page of pages) {
  const own = page.ids;
  for (const m of page.html.matchAll(/href="(\/?#[^"]+)"/g)) {
    const href = m[1];
    const frag = href.slice(href.indexOf('#') + 1);
    if (!frag) continue;
    const target = href.startsWith('/#') ? homeIds : own;
    const where = href.startsWith('/#') ? 'the home page' : 'itself';
    if (!target.has(frag)) dead.push(page.name + ' -> ' + href + ' (not on ' + where + ')');
  }
}
check('no link points at a fragment that does not exist', [...new Set(dead)].slice(0, 8), []);

console.log(NL + '=== no page ships with a blank left in it ===');
// privacy.html and terms.html carry two decisions only the site owner can
// make: where a grievance reaches a human, and which courts. They are written
// as a loud placeholder rather than a plausible guess, because a policy that
// states the wrong jurisdiction is worse than one that admits it is unfinished
// - and a guess would be invisible, where this fails the build.
const blanks = [];
for (const page of pages) {
  if (VERIFY.test(page.name)) continue;
  if (page.text.includes('TO BE SET')) blanks.push(page.name);
}
check('no page still has a TO BE SET placeholder', blanks, []);

console.log(NL + '=== nothing claims a rating nobody gave ===');
// No review has been collected, so no page may carry an aggregateRating.
// This is the one piece of structured data that is worth money to fake, and
// it is the reason Google penalises whole sites for it.
// Comments stripped first: this file's own note explaining why there is no
// aggregateRating was being read as one. A test that fails on the sentence
// promising the thing will not happen teaches people to delete the sentence.
const noComments = (h) => h.replace(/<!--[\s\S]*?-->/g, ' ');
check('no page carries aggregateRating',
  pages.filter((p) => /"aggregateRating"/.test(noComments(p.html))).map((p) => p.name), []);
check('no page carries a Review graph',
  pages.filter((p) => /"@type"\s*:\s*"Review"/.test(noComments(p.html))).map((p) => p.name), []);

console.log(NL + (fails ? fails + ' FAILING' : 'all pass'));
process.exit(fails ? 1 : 0);
