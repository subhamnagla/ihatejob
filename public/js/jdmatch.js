// Comparing a CV against a job advert, the way a recruiter's software does.
//
// An applicant tracking system stores a CV as fields and lets a recruiter
// search them. Nobody is scored out of a hundred by a robot - that story is
// folklore - but a search for "COBOL" does return the CVs containing the word
// and not the ones that describe it some other way. This works out which of
// the things an advert asks for are findable in a CV, and which are not.
//
// Two rules, both about not lying:
//
// 1. The terms it found are shown, always. A number on its own would hide a bad
//    reading behind a confident-looking score; a list lets anyone see in one
//    glance that it has misread the advert.
// 2. No percentage. "14 of 19 things this advert asks for" is a count of what
//    was checked. "74% match" implies the terms are the whole of what matters,
//    and they are not - a person still reads the thing.

const STOP = new Set(('a an the and or but if then than that this these those of in on at to for with '
  + 'by from as is are was were be been being have has had do does did will would shall should can '
  + 'could may might must you your we our they their it its he she his her not no nor so such own '
  + 'same too very just also about into over under across per via within without while during '
  + 'other others any all each both few more most some who whom whose which what when where why how '
  + 'work working works role job position candidate applicant experience experienced years year '
  + 'ability able strong good great excellent proven demonstrated relevant related including include '
  + 'includes required require requires requirement requirements responsibility responsibilities '
  + 'skill skills knowledge understanding familiar familiarity plus bonus desirable preferred '
  + 'essential must nice looking seeking join team teams company business new using use used '
  + 'well etc across level based day days month months full time part').split(' '));

// Phrases every advert contains and no CV is improved by carrying.
const GENERIC = [
  'team player', 'fast paced', 'fast-paced', 'self starter', 'self-starter',
  'detail oriented', 'detail-oriented', 'communication', 'problem solving',
  'hard working', 'hard-working', 'go getter', 'results driven', 'results-driven',
  'dynamic environment', 'excellent communication', 'interpersonal',
];

// Lines under these are what the advert actually demands.
const MUST_HEAD = /\b(?:requirements?|must[- ]haves?|essential|qualifications?|what you(?:'| a)?ll need|who you are|we require|mandatory)\b/i;
const NICE_HEAD = /\b(?:nice[- ]to[- ]have|preferred|desirable|bonus|advantageous|plus points?|good to have|optional)\b/i;
const MUST_INLINE = /\b(?:must have|required|mandatory|essential|minimum of)\b/i;
const NICE_INLINE = /\b(?:nice to have|preferred|desirable|a plus|bonus|advantageous|good to have)\b/i;

const norm = (s) => String(s || '').toLowerCase()
  // Keep the characters that carry meaning in a technology's name: C++, C#,
  // .NET, Node.js, CI/CD. Stripping them turns four different things into "c".
  .replace(/[^a-z0-9+#./\s-]/g, ' ')
  // But a full stop that ends a sentence is not part of the word in front of
  // it. Without this, "Deployed on AWS." never matched a requirement for AWS,
  // because the token was "aws." and the advert asked for "aws".
  .replace(/([a-z0-9+#])\.(?=\s|$)/g, '$1 ')
  .replace(/\s+/g, ' ')
  .trim();

// "engineers" and "engineering" should both find "engineer". Deliberately
// cruder than a real stemmer: over-trimming invents matches that are not there.
function stem(w) {
  if (w.length <= 4) return w;
  return w.replace(/(?:ing|ies|ers|er|es|s)$/, (m) => (m === 'ies' ? 'y' : ''));
}

const stemAll = (t) => norm(t).split(' ').map(stem).join(' ');

function weightOf(lines, i) {
  const line = lines[i];
  if (MUST_INLINE.test(line)) return 'must';
  if (NICE_INLINE.test(line)) return 'nice';
  // Otherwise inherit from the nearest heading above.
  for (let k = i; k >= 0 && i - k < 25; k -= 1) {
    if (NICE_HEAD.test(lines[k])) return 'nice';
    if (MUST_HEAD.test(lines[k])) return 'must';
  }
  return 'body';
}

// High precision on purpose. A candidate term has to look like a thing rather
// than like prose: an acronym, something with a version or a dot in it, or a
// capitalised phrase. Everything else has to earn its place by being repeated.
function candidates(text) {
  const lines = String(text || '').split('\n');
  const found = new Map();

  const add = (rawIn, weight) => {
    // "Strong React" is a requirement for React. Left whole it is looked for
    // verbatim, found nowhere, and reported missing from a CV that says React
    // on every other line - the worst kind of wrong, because it reads as
    // authoritative.
    let words = norm(rawIn).split(' ').filter(Boolean);
    while (words.length > 1 && STOP.has(words[0])) words = words.slice(1);
    while (words.length > 1 && STOP.has(words[words.length - 1])) words = words.slice(0, -1);

    const t = words.join(' ');
    const raw = words.length === norm(rawIn).split(' ').filter(Boolean).length ? rawIn : t;
    if (!t || t.length < 2 || t.length > 40) return;
    if (words.length > 4) return;
    if (words.every((w) => STOP.has(w))) return;
    if (words.length === 1 && (STOP.has(t) || /^\d+$/.test(t))) return;
    if (GENERIC.some((g) => t === g || t.includes(g))) return;

    const prev = found.get(t);
    const rank = { must: 3, nice: 2, body: 1 };
    if (!prev || rank[weight] > rank[prev.weight]) {
      found.set(t, { term: t, label: clean(raw), weight, count: (prev ? prev.count : 0) + 1 });
    } else {
      prev.count += 1;
    }
  };

  const counts = new Map();
  lines.forEach((line, i) => {
    const w = weightOf(lines, i);

    // SQL, AWS, CI/CD, C++, .NET
    (line.match(/\b[A-Z][A-Za-z0-9+#]*(?:[/.][A-Za-z0-9+#]+)*\b/g) || [])
      .filter((m) => /^[A-Z0-9+#./]{2,8}$/.test(m) || /[0-9+#.]/.test(m))
      .forEach((m) => add(m, w));

    // Node.js, React 18, Python3
    (line.match(/\b[A-Za-z][A-Za-z]*(?:\.[a-z]{2,3}|\s?\d{1,2})\b/g) || []).forEach((m) => add(m, w));

    // PostgreSQL, JavaScript, GitHub, MySQL, TypeScript. A capital inside the
    // word is the giveaway, and no pattern above catches it: the acronym rule
    // wants all caps, the phrase rule wants a space and a fresh capital.
    (line.match(/\b[A-Za-z][a-z0-9+#.]*[A-Z][A-Za-z0-9+#.]*\b/g) || [])
      .filter((m) => m.length >= 4)
      .forEach((m) => add(m, w));

    // Machine Learning, Google Analytics, Supply Chain
    (line.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2}\b/g) || []).forEach((m) => add(m, w));

    // Anything repeated across the advert is being emphasised.
    norm(line).split(' ').forEach((word) => {
      if (word.length < 4 || STOP.has(word)) return;
      counts.set(word, (counts.get(word) || 0) + 1);
    });
  });

  [...counts.entries()].filter(([, n]) => n >= 3).forEach(([word]) => {
    const at = lines.findIndex((l) => norm(l).split(' ').includes(word));
    if (at >= 0) add(word, weightOf(lines, at));
  });

  return [...found.values()];
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * @param jd  the advert, pasted as text
 * @param cv  the CV as text
 * @returns   what the advert asks for, and which of it is findable in the CV
 */
export function matchJD(jd, cv) {
  const haystack = ' ' + stemAll(cv) + ' ';
  const raw = ' ' + norm(cv) + ' ';

  const present = (term) => {
    if (raw.includes(' ' + term + ' ')) return true;         // exact, punctuation intact
    const s = stemAll(term);
    return Boolean(s) && haystack.includes(' ' + s + ' ');
  };

  const all = candidates(jd)
    .map((c) => ({ ...c, found: present(c.term) }))
    .sort((a, b) => {
      const rank = { must: 0, nice: 1, body: 2 };
      return rank[a.weight] - rank[b.weight] || b.count - a.count || a.term.localeCompare(b.term);
    })
    // A recruiter is not searching forty terms. Beyond this it is noise, and
    // showing noise is how a tool teaches people to stuff keywords.
    .slice(0, 30);

  const asked = all.filter((c) => c.weight !== 'body');
  const scored = asked.length ? asked : all;

  return {
    terms: all,
    missing: all.filter((c) => !c.found),
    covered: scored.filter((c) => c.found).length,
    total: scored.length,
    // Said in words rather than a percentage, because the count is a count of
    // what was checked and not a measure of whether someone should apply.
    verdict: verdictFor(scored.filter((c) => c.found).length, scored.length),
  };
}

function verdictFor(covered, total) {
  if (!total) return 'That advert was too short to read anything useful out of.';
  const share = covered / total;
  if (share >= 0.85) return 'Nearly everything this advert asks for is findable in your CV.';
  if (share >= 0.6) return 'Most of what this advert asks for is in your CV. The gaps are listed below.';
  if (share >= 0.35) return 'Some of it is there. Several things the advert asks for are not.';
  return 'Little of what this advert asks for appears in your CV as written.';
}
