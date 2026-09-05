// The standardisation checker.
//
// Every rule here is deterministic and runs offline. That matters for two of
// the problems this app exists to solve: a person cannot tell whether their CV
// is "professional", and a person who pasted text from a chatbot cannot tell
// which parts read as machine-written. Both become answerable when you name the
// exact phrase, say why it fails, and suggest the plain replacement.
//
// A rule earns its place only if it can point at a specific string. Vague
// advice ("make it more impactful") is what the user already gets everywhere.

import { SECTIONS } from './schema.js';
import { professionOf, regionOf, personalDetailsRule, pageTarget } from './professions.js';

/* ------------------------------------------------------------- phrase sets */

// Phrases that read as generated or as filler. The replacement is the point:
// telling someone "leverage is bad" without offering "use" just leaves them stuck.
const TELLS = [
  ['leverage', 'use'], ['leveraging', 'using'], ['leveraged', 'used'],
  ['utilize', 'use'], ['utilise', 'use'], ['utilized', 'used'], ['utilised', 'used'],
  ['spearheaded', 'led'], ['spearheading', 'leading'],
  ['orchestrated', 'ran'], ['instrumental in', 'did'],
  ['played a key role in', 'did'], ['played a pivotal role in', 'did'],
  ['results-driven', ''], ['detail-oriented', ''], ['self-starter', ''],
  ['team player', ''], ['go-getter', ''], ['hard-working professional', ''],
  ['dynamic professional', ''], ['seasoned professional', ''],
  ['proven track record', ''], ['track record of success', ''],
  ['wealth of experience', ''], ['passionate about', ''],
  ['think outside the box', ''], ['hit the ground running', ''],
  ['wear many hats', ''], ['synergy', ''], ['synergies', ''],
  ['value-add', ''], ['best-in-class', ''], ['world-class', ''],
  ['cutting-edge', ''], ['state-of-the-art', ''], ['holistic', ''],
  ['delve into', 'look at'], ['delved into', 'looked at'],
  ['tapestry', ''], ['testament to', ''], ['underscores', 'shows'],
  ['pivotal', 'key'], ['myriad', 'many'], ['plethora', 'many'],
  ['realm of', 'in'], ['ever-evolving', ''], ['fast-paced world', ''],
  ['navigate the complexities', 'handle'], ['navigating the complexities', 'handling'],
  // The past tense is the form a CV actually uses, and it was the one form
  // missing - so when the auto-fixer stopped rewriting this phrase, it became
  // neither fixed nor reported.
  ['navigated the complexities', 'handled'],
  ['robust', ''], ['seamless', ''], ['seamlessly', ''],
  ['adept at', 'can'], ['well-versed in', 'know'], ['meticulous', 'careful'],
  ['in today', ''],
];

// Adverbs that claim a result without evidence. Only flagged when the same
// sentence carries no number - "significantly reduced costs by 32%" is fine.
const VAGUE = ['significantly', 'drastically', 'substantially', 'greatly',
  'considerably', 'dramatically', 'vastly', 'markedly', 'massively', 'hugely'];

// Openers that describe a job description rather than a person's work.
const WEAK_OPENERS = ['responsible for', 'worked on', 'helped with', 'helped to',
  'assisted with', 'assisted in', 'involved in', 'tasked with', 'duties included',
  'participated in', 'was part of', 'in charge of', 'handled', 'took care of',
  'my role was', 'i was responsible'];

// Connectives that essays use and CV bullets do not.
const ESSAY_LINKERS = ['furthermore', 'moreover', 'additionally', 'in conclusion',
  'it is worth noting', 'notably,'];

const PERSONAL_DETAILS = ['date of birth', 'd.o.b', 'dob', 'marital status',
  'father\'s name', 'fathers name', 'mother\'s name', 'nationality', 'religion',
  'caste', 'passport number', 'aadhaar', 'aadhar', 'gender', 'sex:', 'age:',
  'blood group'];

/* ---------------------------------------------------------------- helpers */

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
const lines = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean);
const hasNumber = (s) => /\d/.test(String(s || ''));
const lower = (s) => String(s || '').toLowerCase();

// Every piece of prose in the CV, with enough provenance to jump the user
// straight to the field that needs editing.
function textUnits(d) {
  const units = [];
  const push = (section, index, field, label, text) => {
    if (String(text || '').trim()) units.push({ section, index, field, label, text: String(text) });
  };

  lines(d.basics.summary).forEach((l, i) => push('summary', 0, 'summary', 'Summary', l));

  d.experience.forEach((it, i) => {
    lines(it.bullets).forEach((l) => push('experience', i, 'bullets', it.role || it.company || 'Role ' + (i + 1), l));
  });
  d.education.forEach((it, i) => {
    lines(it.details).forEach((l) => push('education', i, 'details', it.degree || 'Education ' + (i + 1), l));
  });
  d.projects.forEach((it, i) => {
    lines(it.bullets).forEach((l) => push('projects', i, 'bullets', it.name || 'Project ' + (i + 1), l));
  });
  d.achievements.forEach((it, i) => push('achievements', i, 'text', 'Achievement ' + (i + 1), it.text));
  d.custom.forEach((it, i) => {
    lines(it.body).forEach((l) => push('custom', i, 'body', it.heading || 'Custom section', l));
  });
  return units;
}

// Bullets only - the places where impact is supposed to live.
function bulletUnits(units) {
  return units.filter((u) => u.section === 'experience' || u.section === 'projects');
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Returns { y, m, shape } or null. `shape` lets us check format consistency.
function parseDate(raw) {
  const s = lower(raw).trim();
  if (!s) return null;
  if (/^(present|current|now|till date|ongoing)$/.test(s)) return { y: 9999, m: 12, shape: 'present' };

  let m = s.match(/^([a-z]{3,9})[a-z.]*\s+(\d{4})$/);
  if (m) {
    const idx = MONTHS.indexOf(m[1].slice(0, 3));
    if (idx >= 0) return { y: +m[2], m: idx + 1, shape: 'Mon YYYY' };
  }
  m = s.match(/^(\d{1,2})[/-](\d{4})$/);
  if (m) return { y: +m[2], m: +m[1], shape: 'MM/YYYY' };
  m = s.match(/^(\d{4})$/);
  if (m) return { y: +m[1], m: 6, shape: 'YYYY' };
  return null;
}

const monthsBetween = (a, b) => (b.y - a.y) * 12 + (b.m - a.m);

function findPhrases(units, list) {
  const hits = [];
  for (const u of units) {
    const text = lower(u.text);
    for (const entry of list) {
      const phrase = Array.isArray(entry) ? entry[0] : entry;
      const idx = text.indexOf(phrase);
      if (idx === -1) continue;
      // require a word boundary so "use" does not match inside "because"
      const before = idx === 0 ? ' ' : text[idx - 1];
      const after = text[idx + phrase.length] || ' ';
      if (/[a-z0-9]/.test(before) || /[a-z]/.test(after)) continue;
      hits.push({ unit: u, phrase, replacement: Array.isArray(entry) ? entry[1] : '' });
    }
  }
  return hits;
}

/**
 * Checks one loose piece of text - a LinkedIn headline, an About section - with
 * the same phrase lists the CV rules use, so the two can never disagree about
 * what counts as filler. Returns [{ phrase, replacement, kind }].
 */
export function checkPhrases(text) {
  const units = [{ text: String(text || '') }];
  const hits = [
    ...findPhrases(units, TELLS).map((h) => ({ ...h, kind: 'tell' })),
    ...findPhrases(units, WEAK_OPENERS).map((h) => ({ ...h, kind: 'weak' })),
    ...findPhrases(units, ESSAY_LINKERS).map((h) => ({ ...h, kind: 'weak' })),
  ];
  // An intensifier is only empty when the text carries no figure at all -
  // "cut costs significantly, by 32%" is doing its job.
  if (!/\d/.test(String(text || ''))) {
    hits.push(...findPhrases(units, VAGUE).map((h) => ({ ...h, kind: 'vague' })));
  }
  const seen = new Set();
  return hits
    .filter((h) => (seen.has(h.phrase) ? false : seen.add(h.phrase)))
    .map(({ phrase, replacement, kind }) => ({ phrase, replacement, kind }));
}

function letterFor(ratio) {
  if (ratio >= 0.95) return 'A+';
  if (ratio >= 0.87) return 'A';
  if (ratio >= 0.78) return 'B+';
  if (ratio >= 0.68) return 'B';
  if (ratio >= 0.58) return 'C+';
  if (ratio >= 0.45) return 'C';
  if (ratio >= 0.30) return 'D';
  return 'E';
}

/* ------------------------------------------------------------------ rules */

export function reviewCV(d, opts = {}) {
  const prof = professionOf(d.settings);
  const region = regionOf(d.settings);
  const pdRule = personalDetailsRule(d.settings);
  const [minPages, maxPages] = pageTarget(d.settings);

  const units = textUnits(d);
  const bullets = bulletUnits(units);
  const findings = [];
  const add = (f) => findings.push(f);

  // Six characters rather than one number. A CV can be immaculate and say
  // nothing, or full of hard evidence and unreadable by a parser - those are
  // different failures and deserve to be reported separately.
  const bands = {
    evidence: {
      name: 'Evidence',
      score: 22, max: 22,
      blurb: 'Do your claims carry numbers, or only adjectives?',
    },
    authenticity: {
      name: 'Authenticity',
      score: 20, max: 20,
      blurb: 'Does this read as written by a person who did the work?',
    },
    precision: {
      name: 'Precision',
      score: 14, max: 14,
      blurb: 'Tight, consistent, specific lines - not padding.',
    },
    fit: {
      name: 'Field fit',
      score: 16, max: 16,
      blurb: 'Does it contain what this profession expects to see?',
    },
    machine: {
      name: 'Machine-readability',
      score: 18, max: 18,
      blurb: 'Will screening software parse it and pass it on?',
    },
    restraint: {
      name: 'Restraint',
      score: 10, max: 10,
      blurb: 'Right length, no keyword stuffing, nothing padded.',
    },
  };
  const deduct = (band, n) => { bands[band].score = Math.max(0, bands[band].score - n); };

  /* --- contact and header ------------------------------------------------ */

  const b = d.basics;
  if (!b.fullName.trim()) {
    add({ id: 'no-name', severity: 'blocker', band: 'machine', title: 'No name on the CV',
      detail: 'The header is empty.', fix: 'Add your full name in Personal details.',
      where: { section: 'basics', field: 'fullName' } });
    deduct('machine', 6);
  }
  if (!b.email.trim()) {
    add({ id: 'no-email', severity: 'blocker', band: 'machine', title: 'No email address',
      detail: 'Applicant tracking systems index the email as your unique identifier. Without one, '
        + 'many systems reject the file outright.',
      fix: 'Add an email in Personal details.', where: { section: 'basics', field: 'email' } });
    deduct('machine', 8);
  } else {
    const local = b.email.split('@')[0] || '';
    if (/(\d{3,})|cool|sexy|rockstar|king|queen|babu|dude|007|143/i.test(local)) {
      add({ id: 'email-informal', severity: 'tip', band: 'machine', title: 'Email address looks informal',
        detail: '"' + b.email + '" reads as a personal handle rather than a professional address.',
        fix: 'Use firstname.lastname@ where you can. It costs nothing and removes a small doubt.',
        where: { section: 'basics', field: 'email' } });
      deduct('machine', 1);
    }
  }
  if (!b.phone.trim()) {
    add({ id: 'no-phone', severity: 'warn', band: 'machine', title: 'No phone number',
      detail: 'Recruiters shortlisting in bulk often call rather than email.',
      fix: 'Add a phone number with country code.', where: { section: 'basics', field: 'phone' } });
    deduct('machine', 3);
  }
  if (!b.location.trim()) {
    add({ id: 'no-location', severity: 'tip', band: 'machine', title: 'No location',
      detail: 'Location is a common filter, especially for on-site roles.',
      fix: 'City and country is enough. A full street address is not wanted.',
      where: { section: 'basics', field: 'location' } });
    deduct('machine', 1);
  }
  if (!b.headline.trim()) {
    add({ id: 'no-headline', severity: 'warn', band: 'machine', title: 'No job title under your name',
      detail: 'The headline tells a screener in one second which pile you belong in.',
      fix: 'Add the role you are applying for, e.g. "' + prof.name + ' - 3 years".',
      where: { section: 'basics', field: 'headline' } });
    deduct('machine', 2);
  }

  /* --- region rules: photo and personal details -------------------------- */

  if (b.photo && d.settings.showPhoto) {
    if (region.photo === 'forbidden') {
      add({ id: 'photo-forbidden', severity: 'blocker', band: 'machine',
        title: 'Remove the photo for ' + region.name,
        detail: region.note,
        fix: 'Turn off "Show photo" under Format & design, or switch the region if you are applying elsewhere.',
        where: { section: 'design' } });
      deduct('machine', 6);
    } else if (region.photo === 'discouraged') {
      add({ id: 'photo-discouraged', severity: 'warn', band: 'machine',
        title: 'A photo is unusual for ' + region.name,
        detail: region.note, fix: 'Consider turning the photo off.', where: { section: 'design' } });
      deduct('machine', 2);
    }
  } else if (region.photo === 'expected' && !b.photo) {
    add({ id: 'photo-expected', severity: 'tip', band: 'machine',
      title: 'A photo is conventional for ' + region.name,
      detail: region.note, fix: 'Upload a plain headshot under Format & design.',
      where: { section: 'design' } });
  }

  const pdHits = findPhrases(units, PERSONAL_DETAILS);
  if (pdHits.length && pdRule === 'forbidden') {
    add({ id: 'personal-details', severity: 'blocker', band: 'machine',
      title: 'Personal details do not belong on a ' + region.name + ' CV',
      detail: 'Found ' + pdHits.map((h) => '"' + h.phrase + '"').slice(0, 4).join(', ')
        + '. ' + region.note,
      fix: 'Delete date of birth, marital status, gender, nationality and religion.',
      samples: pdHits.slice(0, 4).map((h) => ({ text: h.unit.text, where: h.unit })),
      where: pdHits[0].unit });
    deduct('machine', 7);
  }

  /* --- evidence and impact ----------------------------------------------- */

  const withNumbers = bullets.filter((u) => hasNumber(u.text));
  const metricPct = bullets.length ? Math.round((withNumbers.length / bullets.length) * 100) : 0;

  if (bullets.length === 0) {
    add({ id: 'no-bullets', severity: 'blocker', band: 'evidence', title: 'No bullet points anywhere',
      detail: 'Roles without bullets give a reader nothing to judge.',
      fix: 'Add two to five lines under each role saying what you did and what changed.',
      where: { section: 'experience' } });
    deduct('evidence', 20);
  } else if (metricPct < 40) {
    const short = 40 - metricPct;
    add({ id: 'few-metrics', severity: metricPct < 20 ? 'warn' : 'tip', band: 'evidence',
      title: 'Only ' + metricPct + '% of your bullets contain a number',
      detail: 'Aim for at least 40%. Numbers are the difference between a claim and a fact, and they '
        + 'are what a hiring manager remembers. Useful measures for ' + prof.name.toLowerCase()
        + ': ' + prof.metrics.slice(0, 5).join(', ') + '.',
      fix: 'Take your ' + Math.min(4, bullets.length - withNumbers.length)
        + ' strongest bullets and attach a figure: how much, how many, how fast, how often.',
      where: { section: 'experience' } });
    deduct('evidence', Math.min(12, Math.round(short / 4)));
  }

  const weakHits = findPhrases(bullets, WEAK_OPENERS);
  if (weakHits.length) {
    add({ id: 'weak-openers', severity: 'warn', band: 'evidence',
      title: weakHits.length + (weakHits.length === 1 ? ' bullet describes a duty, not an achievement' : ' bullets describe duties, not achievements'),
      detail: 'Openers like "responsible for" and "worked on" copy the job description back to the '
        + 'employer. They tell the reader what you were assigned, not what you accomplished.',
      fix: 'Start with a verb that carries a result: ' + prof.verbs.slice(0, 5).join(', ') + '.',
      samples: weakHits.slice(0, 5).map((h) => ({ text: h.unit.text, where: h.unit, phrase: h.phrase })),
      where: weakHits[0].unit });
    deduct('evidence', Math.min(8, weakHits.length * 2));
  }

  const vagueHits = findPhrases(bullets, VAGUE).filter((h) => !hasNumber(h.unit.text));
  if (vagueHits.length) {
    add({ id: 'vague-claims', severity: 'warn', band: 'evidence',
      title: vagueHits.length + ' unverifiable claim' + (vagueHits.length === 1 ? '' : 's'),
      detail: 'Words like "significantly" and "drastically" promise a result but withhold the size of it. '
        + 'An experienced reader treats them as a signal that no number exists.',
      fix: 'Replace the adverb with the figure, or drop the claim.',
      samples: vagueHits.slice(0, 5).map((h) => ({ text: h.unit.text, where: h.unit, phrase: h.phrase })),
      where: vagueHits[0].unit });
    deduct('evidence', Math.min(6, vagueHits.length * 2));
  }

  // Same verb opening many bullets reads as one sentence written six times.
  const verbCount = new Map();
  bullets.forEach((u) => {
    const first = lower(words(u.text)[0] || '').replace(/[^a-z]/g, '');
    if (first.length > 2) verbCount.set(first, (verbCount.get(first) || 0) + 1);
  });
  const overused = [...verbCount.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  if (overused.length) {
    add({ id: 'repeated-verbs', severity: 'tip', band: 'precision',
      title: 'The word "' + overused[0][0] + '" starts ' + overused[0][1] + ' bullets',
      detail: 'Repeating one opener flattens everything you did into a single texture.',
      fix: 'Vary the verb: ' + prof.verbs.slice(0, 6).join(', ') + '.',
      where: { section: 'experience' } });
    deduct('precision', 2);
  }

  /* --- writing quality: the AI-text problem ------------------------------ */

  const tellHits = findPhrases(units, TELLS);
  if (tellHits.length) {
    const uniq = [...new Set(tellHits.map((h) => h.phrase))];
    const severity = tellHits.length >= 6 ? 'blocker' : tellHits.length >= 3 ? 'warn' : 'tip';
    add({ id: 'ai-tells', severity, band: 'authenticity',
      title: tellHits.length + ' phrase' + (tellHits.length === 1 ? '' : 's') + ' that read as generated or filler',
      detail: 'Found ' + uniq.slice(0, 6).map((p) => '"' + p + '"').join(', ')
        + (uniq.length > 6 ? ' and ' + (uniq.length - 6) + ' more' : '')
        + '. These appear in a large share of chatbot-written CVs, and recruiters have learned to spot '
        + 'them. The deeper problem is that they carry no information: "leveraged robust solutions" '
        + 'describes no actual work.',
      fix: 'Say the concrete thing instead. Where a plain replacement exists it is shown below.',
      samples: tellHits.slice(0, 8).map((h) => ({
        text: h.unit.text, where: h.unit, phrase: h.phrase,
        suggest: h.replacement ? 'use "' + h.replacement + '"' : 'delete it',
      })),
      where: tellHits[0].unit });
    deduct('authenticity', Math.min(14, tellHits.length * 2));
  }

  // Human-written bullets vary in length because the underlying facts vary.
  // Generated ones tend to arrive at a uniform, comfortable size.
  if (bullets.length >= 5) {
    const lens = bullets.map((u) => words(u.text).length);
    const mean = lens.reduce((a, x) => a + x, 0) / lens.length;
    const sd = Math.sqrt(lens.reduce((a, x) => a + (x - mean) ** 2, 0) / lens.length);
    if (sd < 2.6 && mean > 12) {
      add({
        id: 'uniform-bullets', severity: 'tip', band: 'authenticity',
        title: 'Every bullet is almost exactly the same length',
        detail: 'Your ' + bullets.length + ' bullets average ' + Math.round(mean)
          + ' words with very little variation. Real achievements are not all the same size, '
          + 'so this evenness is one of the more reliable signs that text was generated rather '
          + 'than recalled.',
        fix: 'Let the short ones be short. A four-word bullet with a number beats a padded fifteen.',
        where: { section: 'experience' },
      });
      deduct('authenticity', 3);
    }
  }

  const linkerHits = findPhrases(units, ESSAY_LINKERS);
  if (linkerHits.length) {
    add({ id: 'essay-linkers', severity: 'warn', band: 'authenticity',
      title: 'Essay connectives in a CV',
      detail: '"Furthermore" and "Moreover" join paragraphs in an essay. CV bullets are a list - '
        + 'they do not need joining, and the words are a strong sign the text was generated as prose.',
      fix: 'Delete the connective and start with the verb.',
      samples: linkerHits.slice(0, 4).map((h) => ({ text: h.unit.text, where: h.unit, phrase: h.phrase })),
      where: linkerHits[0].unit });
    deduct('authenticity', Math.min(5, linkerHits.length * 2));
  }

  const firstPerson = units.filter((u) => /\b(i|my|me|myself)\b/i.test(u.text));
  if (firstPerson.length) {
    add({ id: 'first-person', severity: 'warn', band: 'precision',
      title: 'First person used in ' + firstPerson.length + ' place' + (firstPerson.length === 1 ? '' : 's'),
      detail: 'CVs are written in an implied first person - the "I" is understood and left out.',
      fix: 'Drop "I" and start with the verb: "I managed a team" becomes "Managed a team".',
      samples: firstPerson.slice(0, 4).map((u) => ({ text: u.text, where: u })),
      where: firstPerson[0] });
    deduct('precision', Math.min(6, firstPerson.length * 2));
  }

  const longBullets = bullets.filter((u) => words(u.text).length > 34);
  if (longBullets.length) {
    add({ id: 'long-bullets', severity: 'tip', band: 'precision',
      title: longBullets.length + ' bullet' + (longBullets.length === 1 ? ' is' : 's are') + ' too long',
      detail: 'Past about 30 words a bullet stops being scanned and starts being skipped. '
        + 'Long, evenly-sized paragraphs are also a common shape for pasted generated text.',
      fix: 'Cut to one idea per line. If it needs two ideas, make it two bullets.',
      samples: longBullets.slice(0, 3).map((u) => ({ text: u.text, where: u })),
      where: longBullets[0] });
    deduct('precision', Math.min(4, longBullets.length));
  }

  const shoutBullets = bullets.filter((u) => u.text.length > 12 && u.text === u.text.toUpperCase());
  if (shoutBullets.length) {
    add({ id: 'all-caps', severity: 'warn', band: 'precision', title: 'Lines written in capitals',
      detail: 'Capitals slow reading and some parsers mangle them.',
      fix: 'Use sentence case.', samples: shoutBullets.slice(0, 3).map((u) => ({ text: u.text, where: u })),
      where: shoutBullets[0] });
    deduct('precision', 3);
  }

  /* --- completeness against the profession ------------------------------- */

  const filled = (id) => {
    if (id === 'summary') return Boolean(d.basics.summary.trim());
    return Array.isArray(d[id]) && d[id].length > 0;
  };

  for (const id of prof.require || []) {
    if (filled(id)) continue;
    const label = (prof.labels && prof.labels[id]) || (SECTIONS[id] && SECTIONS[id].title) || id;
    add({ id: 'missing-' + id, severity: 'blocker', band: 'fit',
      title: label + ' is empty',
      detail: (prof.guidance && prof.guidance[id])
        || ('A ' + prof.name + ' CV is expected to have this section.'),
      fix: 'Open ' + label + ' in the editor and add at least one entry.',
      where: { section: id } });
    deduct('fit', 5);
  }
  for (const id of prof.recommend || []) {
    if (filled(id)) continue;
    const label = (prof.labels && prof.labels[id]) || (SECTIONS[id] && SECTIONS[id].title) || id;
    add({ id: 'recommend-' + id, severity: 'tip', band: 'fit',
      title: label + ' is worth adding',
      detail: (prof.guidance && prof.guidance[id]) || 'Common on strong CVs in this field.',
      fix: 'Add one or two entries.', where: { section: id } });
    deduct('fit', 1);
  }

  const anyLink = [b.website, b.linkedin, b.github].some((x) => String(x || '').trim());
  if (prof.wants && prof.wants.link && !anyLink) {
    add({ id: 'no-link', severity: 'warn', band: 'fit', title: 'No portfolio or profile link',
      detail: prof.wants.link, fix: 'Add a website, GitHub or LinkedIn URL in Personal details.',
      where: { section: 'basics', field: 'website' } });
    deduct('fit', 3);
  }

  const skillItems = d.skills.reduce((n, g) => n + String(g.items || '').split(',').filter((s) => s.trim()).length, 0);
  if (d.skills.length && skillItems < 6) {
    add({ id: 'thin-skills', severity: 'tip', band: 'restraint', title: 'Only ' + skillItems + ' skills listed',
      detail: 'Keyword matching is how most systems shortlist. A thin list matches nothing.',
      fix: 'List the tools and methods you would be comfortable being asked about in an interview.',
      where: { section: 'skills' } });
    deduct('restraint', 1);
  } else if (skillItems > 45) {
    add({ id: 'stuffed-skills', severity: 'warn', band: 'restraint', title: skillItems + ' skills is keyword stuffing',
      detail: 'Long undifferentiated skill lists read as padding, and an interviewer may pick the '
        + 'weakest item on it.',
      fix: 'Keep what you would defend under questioning. Twenty to thirty is plenty.',
      where: { section: 'skills' } });
    deduct('restraint', 2);
  }

  const summaryWords = words(d.basics.summary).length;
  if (summaryWords > 90) {
    add({ id: 'long-summary', severity: 'tip', band: 'restraint', title: 'Summary is ' + summaryWords + ' words',
      detail: 'The summary is read for about four seconds. Past roughly 70 words it is skimmed.',
      fix: 'Cut to three or four lines.', where: { section: 'summary' } });
    deduct('restraint', 1);
  }

  /* --- structure, dates and consistency ---------------------------------- */

  const shapes = new Set();
  const dated = [];
  let badDates = 0;
  d.experience.forEach((it, i) => {
    const s = parseDate(it.start);
    const e = it.current ? { y: 9999, m: 12, shape: 'present' } : parseDate(it.end);
    if (s) shapes.add(s.shape);
    if (e && e.shape !== 'present') shapes.add(e.shape);
    if (!s && (it.role || it.company)) badDates += 1;
    if (s && e) {
      if (e.y !== 9999 && monthsBetween(s, e) < 0) {
        add({ id: 'date-reversed-' + i, severity: 'warn', band: 'precision',
          title: 'End date is before the start date',
          detail: (it.role || 'A role') + ' runs from ' + it.start + ' to ' + it.end + '.',
          fix: 'Correct the dates.', where: { section: 'experience', index: i, field: 'start' } });
        deduct('precision', 2);
      }
      dated.push({ i, s, e, it });
    }
  });

  if (badDates) {
    add({ id: 'missing-dates', severity: 'warn', band: 'machine',
      title: badDates + ' role' + (badDates === 1 ? ' has' : 's have') + ' no readable start date',
      detail: 'Screeners check tenure first. Missing or free-text dates read as something being hidden, '
        + 'and parsers drop the role entirely.',
      fix: 'Use a consistent format such as "Mar 2021".', where: { section: 'experience' } });
    deduct('machine', 2);
  }
  if (shapes.size > 1) {
    add({ id: 'date-formats', severity: 'tip', band: 'machine', title: 'Mixed date formats',
      detail: 'Found ' + [...shapes].join(' and ') + ' in the same CV.',
      fix: 'Pick one format - ' + region.dateFormat + ' suits ' + region.name + ' - and use it everywhere.',
      where: { section: 'experience' } });
    deduct('machine', 1);
  }

  dated.sort((a, b2) => (a.s.y - b2.s.y) || (a.s.m - b2.s.m));
  for (let i = 1; i < dated.length; i += 1) {
    const prevEnd = dated[i - 1].e;
    if (prevEnd.y === 9999) continue;
    const gap = monthsBetween(prevEnd, dated[i].s);
    if (gap >= 7) {
      add({ id: 'gap-' + i, severity: 'tip', band: 'restraint',
        title: 'A ' + gap + '-month gap in your history',
        detail: 'Between ' + (dated[i - 1].it.role || 'the previous role') + ' ending '
          + (dated[i - 1].it.end || '') + ' and ' + (dated[i].it.role || 'the next role')
          + ' starting ' + (dated[i].it.start || '') + '.',
        fix: 'Gaps are normal and rarely disqualifying, but an unexplained one invites a question. '
          + 'A one-line entry - study, caring, travel, illness, a failed venture - closes it.',
        where: { section: 'experience', index: dated[i].i } });
      deduct('restraint', 1);
    }
  }

  const enders = bullets.map((u) => /[.]$/.test(u.text.trim()));
  if (enders.length > 3 && enders.some(Boolean) && enders.some((x) => !x)) {
    add({ id: 'punctuation', severity: 'tip', band: 'precision', title: 'Inconsistent bullet punctuation',
      detail: 'Some bullets end with a full stop and some do not.',
      fix: 'Pick one and apply it throughout. Either is acceptable.', where: { section: 'experience' } });
    deduct('precision', 1);
  }

  const pages = opts.pages || 0;
  if (pages) {
    if (pages > maxPages) {
      add({ id: 'too-long', severity: 'warn', band: 'restraint',
        title: 'CV runs to ' + pages + ' pages; ' + maxPages + ' is the ceiling here',
        detail: prof.name + ' CVs for ' + region.name + ' are expected to run '
          + (minPages === maxPages ? minPages + ' page' : minPages + ' to ' + maxPages + ' pages') + '.',
        fix: 'Cut the oldest roles to one line each, and remove anything older than about fifteen years.',
        where: { section: 'design' } });
      deduct('restraint', 3);
    } else if (pages < minPages) {
      add({ id: 'too-short', severity: 'tip', band: 'restraint',
        title: 'CV is shorter than usual for this field',
        detail: prof.name + ' CVs usually run at least ' + minPages + ' page'
          + (minPages === 1 ? '' : 's') + '.',
        fix: 'There is room to add evidence - projects, measurable results, tools.',
        where: { section: 'design' } });
      deduct('restraint', 1);
    }
  }

  /* --- score ------------------------------------------------------------- */

  const total = Object.values(bands).reduce((n, x) => n + x.score, 0);
  const order = { blocker: 0, warn: 1, tip: 2 };
  findings.sort((x, y) => order[x.severity] - order[y.severity]);

  const blockers = findings.filter((f) => f.severity === 'blocker').length;
  const weakest = Object.entries(bands)
    .map(([id, v]) => ({ id, ...v, ratio: v.score / v.max }))
    .sort((a, b2) => a.ratio - b2.ratio)[0];

  const verdict = blockers
    ? 'Fix the ' + blockers + ' blocking issue' + (blockers === 1 ? '' : 's')
      + ' before sending this anywhere. ' + weakest.name + ' is the weakest area.'
    : total >= 85
      ? 'This would hold up in front of a recruiter for ' + prof.name.toLowerCase() + ' roles.'
      : 'Nothing here disqualifies you, but ' + weakest.name.toLowerCase()
        + ' is where you would gain the most.';

  return {
    score: Math.round(total),
    letter: letterFor(total / 100),
    grade: total >= 85 ? 'Strong' : total >= 70 ? 'Solid' : total >= 50 ? 'Needs work' : 'Not ready',
    verdict,
    weakest: weakest.name,
    bands: Object.entries(bands).map(([id, v]) => ({
      id, ...v, letter: letterFor(v.score / v.max),
    })),
    findings,
    stats: {
      bullets: bullets.length,
      metricPct,
      words: units.reduce((n, u) => n + words(u.text).length, 0),
      skills: skillItems,
      pages,
      profession: prof.name,
      region: region.name,
      target: minPages === maxPages ? minPages + ' page' : minPages + '-' + maxPages + ' pages',
    },
  };
}
