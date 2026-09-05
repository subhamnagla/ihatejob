// Automatic clean-up.
//
// The checker tells you what is wrong; this applies the fixes that a machine
// can make safely. The bar for inclusion is strict: a fix goes in only if it is
// mechanical and cannot change what you are claiming about yourself.
//
// Deliberately NOT automated: rewriting "Responsible for developing X" into
// "Developed X" needs verb morphology that gets irregular verbs wrong ("ran"
// becomes "runned"), and adding numbers to bullets would mean inventing facts.
// Those stay flagged for a human.

import { regionOf, personalDetailsRule } from './professions.js';

const TELL_MAP = [
  [/\bleverag(e|ed|ing)\b/gi, (m) => ({ leverage: 'use', leveraged: 'used', leveraging: 'using' }[m.toLowerCase()] || 'use')],
  [/\butilis(e|ed|ing)\b/gi, (m) => ({ utilise: 'use', utilised: 'used', utilising: 'using' }[m.toLowerCase()] || 'use')],
  [/\butiliz(e|ed|ing)\b/gi, (m) => ({ utilize: 'use', utilized: 'used', utilizing: 'using' }[m.toLowerCase()] || 'use')],
  [/\bspearheaded\b/gi, () => 'led'],
  [/\bspearheading\b/gi, () => 'leading'],
  [/\borchestrated\b/gi, () => 'ran'],
  [/\bdelved? into\b/gi, () => 'looked at'],
  [/\bunderscores\b/gi, () => 'shows'],
  // The article has to go with it. Without that, "across a myriad of channels"
  // came out as "across a many channels".
  [/\b(?:a|an)\s+(?:myriad|plethora|multitude)\s+of\b/gi, () => 'many'],
  [/\b(?:myriad|plethora|multitude)\s+of\b/gi, () => 'many'],
  [/\bmeticulous\b/gi, () => 'careful'],
];

// Deliberately not substituted, though the checker still flags every one:
//
//   adept at                      "adept at handling X"  -> "can handling X"
//   well-versed in                "I am well-versed in X" -> "I am know X"
//   navigate the complexities of  same class
//
// Each needs the verb after it to change form, and the rule in this file is
// that a fix must be mechanical. Swapping the phrase and leaving the verb alone
// produces confident nonsense on someone's CV, which is worse than the filler
// it replaced. These stay flagged for a person to rewrite.

// Empty modifiers. Deleting one leaves the sentence intact: "a robust API"
// becomes "an API" - grammatical, and no claim was lost.
const TELL_ADJECTIVES = [
  'results-driven', 'detail-oriented', 'self-starter', 'go-getter',
  'hard-working', 'best-in-class', 'world-class', 'cutting-edge',
  'state-of-the-art', 'holistic', 'ever-evolving', 'robust', 'seamless',
  'seamlessly', 'highly motivated', 'proven',
];

// Empty noun phrases. These need their article and any trailing "of" removed
// too, or "with a proven track record of success" collapses to "with a success".
const TELL_NOUNS = [
  'proven track record', 'track record of success', 'track record',
  'wealth of experience', 'synergies', 'synergy', 'value-add', 'tapestry',
];

const VAGUE = ['significantly', 'drastically', 'substantially', 'greatly',
  'considerably', 'dramatically', 'vastly', 'markedly', 'massively', 'hugely'];

const LINKERS = ['furthermore', 'moreover', 'additionally', 'in conclusion', 'notably'];

const PERSONAL = /\b(date of birth|d\.?o\.?b\.?|marital status|father'?s name|mother'?s name|nationality|religion|caste|passport number|aadhaa?r|blood group|\bgender\b|\bsex\b)\b/i;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ---------------------------------------------------------------- helpers */

const tidySpace = (s) => s.replace(/[ \t]{2,}/g, ' ')
  .replace(/\s+([,.;:])/g, '$1')
  .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
  .replace(/^[ \t]+|[ \t]+$/gm, '');

// Restores the capital when a fix removed the word that used to carry it:
// "Leveraged Docker" losing its opener should not leave a lowercase line.
//
// `was` is the line before the fix, and it decides. A summary that wraps
// mid-sentence gives this function a line beginning "professionals. I am..." -
// lowercase because it is the middle of a sentence, not the start of one - and
// capitalising it produced "a team of driven / Professionals." on a real CV.
// If the line did not start with a capital before, it does not gain one.
function capFirst(s, was) {
  const t = s.replace(/^[\s,;:-]+/, '');
  if (was !== undefined && !/^[\s,;:-]*[A-Z]/.test(was)) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Walk every editable prose field, letting a function rewrite each line.
const PROSE = [
  ['basics', null, 'summary'],
  ['experience', 'bullets'],
  ['education', 'details'],
  ['projects', 'bullets'],
  ['achievements', 'text'],
  ['custom', 'body'],
];

function mapProse(d, fn) {
  let changes = 0;
  for (const [section, field, single] of PROSE) {
    if (single) {
      const before = d.basics[single] || '';
      const after = before.split('\n').map(fn).join('\n');
      if (after !== before) { changes += 1; d.basics[single] = after; }
      continue;
    }
    for (const item of d[section] || []) {
      const before = item[field] || '';
      if (!before) continue;
      const after = before.split('\n').map(fn).join('\n');
      if (after !== before) { changes += 1; item[field] = after; }
    }
  }
  return changes;
}

// Count how many lines a rewrite would touch, without touching them.
function countProse(d, fn) {
  let n = 0;
  const probe = (line) => {
    const out = fn(line);
    if (out !== line) n += 1;
    return line;
  };
  for (const [section, field, single] of PROSE) {
    if (single) { (d.basics[single] || '').split('\n').forEach(probe); continue; }
    for (const item of d[section] || []) (item[field] || '').split('\n').forEach(probe);
  }
  return n;
}

function parseDate(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (/^(present|current|now|till date|ongoing)$/.test(s)) return 'present';
  let m = s.match(/^([a-z]{3,9})[a-z.]*\s+(\d{4})$/);
  if (m) {
    const i = MONTHS.findIndex((x) => x.toLowerCase() === m[1].slice(0, 3));
    if (i >= 0) return { y: +m[2], m: i + 1 };
  }
  m = s.match(/^(\d{1,2})[/.\-](\d{4})$/);
  if (m) return { y: +m[2], m: +m[1] };
  m = s.match(/^(\d{4})[/.\-](\d{1,2})$/);
  if (m) return { y: +m[1], m: +m[2] };
  m = s.match(/^(\d{4})$/);
  if (m) return { y: +m[1], m: 0 };
  return null;
}

function formatDate(v, shape) {
  if (!v || v === 'present') return null;
  if (!v.m) return String(v.y); // a bare year stays a bare year
  const mm = String(v.m).padStart(2, '0');
  if (shape === 'MM/YYYY') return mm + '/' + v.y;
  if (shape === 'YYYY/MM') return v.y + '/' + mm;
  if (shape === 'YYYY.MM') return v.y + '.' + mm;
  return MONTHS[v.m - 1] + ' ' + v.y;
}

/* ------------------------------------------------------------ line rules */

const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A rewrite that removes most of a line has not cleaned it, it has broken it.
// In that case the line is left alone and stays flagged for a human, because
// bad grammar on a CV is worse than filler.
// Look for actual breakage rather than guessing from length: a clause that now
// starts with a bare linking verb ("Am a developer") has lost its subject, and
// a line cut to almost nothing has lost its meaning. Both revert.
const ORPHAN_VERB = /^(?:am|is|are|was|were|be|been|being|have|has|had|will|would|do|does|did)\b/i;

// The three checks above only catch a rewrite that collapsed. They passed
// "Can handling fast-paced environments", "across a many channels" and
// "A professional of digital marketing" without complaint, because none of
// those is short, empty, or missing its first word - they are simply not
// English. Every pattern here was produced by this file before it was caught.
const BROKEN = [
  // a modal stranded in front of a gerund: "can handling"
  /\b(?:can|could|shall|should|will|would|may|might|must)\s+\w+ing\b/i,
  // an auxiliary in front of a bare verb: "I am know"
  /\b(?:am|is|are|was|were)\s+(?:know|use|can|handle|lead|run|make|take)\b/i,
  // an article in front of a quantifier: "a many"
  /\b(?:a|an)\s+(?:many|several|various|numerous|few)\b/i,
  // two prepositions colliding where a clause was cut out: "with in"
  /\b(?:with|of|in|for|to|on|at|by|from)\s+(?:with|of|in|for|on|at|by|from)\b/i,
  // punctuation left touching itself
  /,\s*[,.;]|\(\s*\)/,
];

function guard(before, after) {
  const w = (s) => s.trim().split(/\s+/).filter(Boolean).length;
  if (!w(after)) return before;
  if (ORPHAN_VERB.test(after.trim())) return before;
  if (w(after) < 3 && w(before) >= 6) return before;
  // Only blame the rewrite for breakage it introduced. Someone whose original
  // line already reads "responsible for for the team" keeps their own typo
  // rather than losing every other fix on the line.
  if (BROKEN.some((re) => re.test(after) && !re.test(before))) return before;
  return after;
}

// "…with a proven track record of success" has to go as one unit, preposition
// included, or the remnant reads "…with success".
// The tail used to be (?:of|in|for) followed by up to two words, which was
// greedy enough to eat real content: "with a proven track record in the realm
// of digital marketing" lost "in the realm", and the line came out as
// "A professional of digital marketing". Only "of success" and its handful of
// synonyms are empty enough to remove - anything after "in" or "for" is the
// subject matter, and belongs to the person.
// And it only goes when nothing real is hanging off it. Every one of these was
// produced by the version without the lookahead below:
//
//   with a wealth of experience in distributed systems -> "An engineer in
//     distributed systems."
//   with a demonstrated ability to lead teams -> "An engineer to lead teams."
//   with a passion for distributed systems -> "A developer distributed systems."
//   with a proven track record of delivery across three teams -> "An engineer
//     across three teams."
//
// The filler is genuinely empty; what follows it is the subject matter, and
// cutting the one strands the other. So the clause is removed only where it
// runs to a comma or a full stop, and otherwise left for the checker to flag -
// the same call made for "adept at", and for the same reason: a phrase left in
// is one the person can rewrite, and a sentence broken by a tool is one they
// may never notice.
const FILLER_PHRASE = new RegExp(
  '[ ,]*\\b(?:with|having|bringing)\\s+(?:a|an|the)?\\s*'
  + '(?:proven\\s+track\\s+record|track\\s+record|wealth\\s+of\\s+experience|'
  + 'demonstrated\\s+ability|passion\\s+for)'
  + '(?:\\s+of\\s+(?:success|excellence|achievement|delivery|results))?'
  + '\\b(?=\\s*[.,;]|\\s*$)', 'gi',
);

function stripFiller(line) {
  let out = line.replace(FILLER_PHRASE, '');
  for (const [re, to] of TELL_MAP) out = out.replace(re, (m) => to(m));
  for (const phrase of TELL_ADJECTIVES) {
    out = out.replace(new RegExp('\\b' + rx(phrase) + '\\b[ ,]*', 'gi'), '');
  }
  for (const phrase of TELL_NOUNS) {
    // The same rule as FILLER_PHRASE: only where the clause ends. Without this
    // lookahead, "with a proven track record of delivery across three teams"
    // lost its middle and came back as "with delivery across three teams".
    const ends = '\\b(?=\\s*[.,;]|\\s*$)';
    out = out.replace(new RegExp('\\b(?:a|an|the)\\s+' + rx(phrase) + ends + '[ ,]*', 'gi'), '');
    out = out.replace(new RegExp('\\b' + rx(phrase) + ends + '[ ,]*', 'gi'), '');
  }
  // "a" left in front of a vowel, or a dangling preposition at the end
  out = tidySpace(out).replace(/\ba (?=[aeiou])/gi, 'an ').replace(/\s+(?:with|of|in|for)\s*$/i, '');
  return guard(line, capFirst(out, line));
}

function stripVague(line) {
  if (/\d/.test(line)) return line; // a number is present, the adverb is earned
  let out = line;
  for (const w of VAGUE) out = out.replace(new RegExp('\\b' + w + '\\b[ ]*', 'gi'), '');
  return guard(line, capFirst(tidySpace(out), line));
}

function stripLinkers(line) {
  let out = line;
  for (const w of LINKERS) {
    out = out.replace(new RegExp('^\\s*' + w + '\\b[,:]?\\s*', 'i'), '');
  }
  return out === line ? line : capFirst(tidySpace(out), line);
}

// Verbs that cannot simply lose their subject. "I am a developer" does not
// become "Am a developer" - that clause needs rewriting by a person, so it is
// left alone and stays flagged.
const LINKING = /^(?:am|is|are|was|were|be|been|being|will|would|can|could|shall|should|may|might|must|do|does|did|'m|'ve|'d|'ll)\b/i;

// Only the safe, sentence-initial case: "I led the team" -> "Led the team".
function stripFirstPerson(line) {
  const m = line.match(/^\s*I\s+(?:have\s+|had\s+)?([a-z][\w'-]*)/i);
  if (!m) return line;
  if (LINKING.test(m[1])) return line;

  const out = line.replace(/^\s*I\s+(?:have\s+|had\s+)?/i, '');
  return guard(line, capFirst(tidySpace(out), line));
}

function fixCaps(line) {
  const letters = line.replace(/[^A-Za-z]/g, '');
  if (letters.length < 12 || line !== line.toUpperCase()) return line;
  return capFirst(line.toLowerCase());
}

/* ------------------------------------------------------------- the fixes */

export function availableFixes(d) {
  const region = regionOf(d.settings);
  const pdForbidden = personalDetailsRule(d.settings) === 'forbidden';
  const list = [];

  const proseFix = (id, label, detail, fn) => {
    const count = countProse(d, fn);
    if (count) list.push({ id, label, detail, count, run: (doc) => mapProse(doc, fn) });
  };

  proseFix('filler', 'Remove filler and generated phrasing',
    'Replaces "leveraged" with "used", "spearheaded" with "led", and deletes empty claims '
    + 'like "results-driven" and "proven track record".', stripFiller);

  proseFix('vague', 'Drop unbacked intensifiers',
    'Removes "significantly", "drastically" and similar from lines that carry no number, '
    + 'so the claim stands on its own.', stripVague);

  proseFix('linkers', 'Remove essay connectives',
    'Strips a leading "Furthermore", "Moreover" or "Additionally" from bullets.', stripLinkers);

  proseFix('firstperson', 'Remove "I" from the start of lines',
    'Turns "I led the team" into "Led the team". Only touches the opening word, never the '
    + 'middle of a sentence.', stripFirstPerson);

  proseFix('caps', 'Convert shouting to sentence case',
    'Rewrites lines typed entirely in capitals.', fixCaps);

  proseFix('spacing', 'Tidy spacing and punctuation',
    'Collapses double spaces and removes spaces before commas and full stops.',
    (l) => tidySpace(l));

  /* --- personal details the region forbids ------------------------------- */
  if (pdForbidden) {
    const hits = countProse(d, (l) => (PERSONAL.test(l) ? '' : l));
    if (hits) {
      list.push({
        id: 'personal',
        label: 'Delete personal details',
        detail: 'Date of birth, marital status, gender, nationality and similar are not accepted on '
          + 'a ' + region.name + ' CV. This removes the lines that contain them.',
        count: hits,
        destructive: true,
        run: (doc) => mapProse(doc, (l) => (PERSONAL.test(l) ? '' : l)),
      });
    }
  }

  /* --- dates ------------------------------------------------------------- */
  const shape = region.dateFormat;
  const dateTargets = [];
  for (const it of d.experience) dateTargets.push([it, 'start'], [it, 'end']);
  for (const it of d.education) dateTargets.push([it, 'start'], [it, 'end']);
  const dateCount = dateTargets.filter(([it, k]) => {
    const v = parseDate(it[k]);
    const f = formatDate(v, shape);
    return f && f !== it[k];
  }).length;
  if (dateCount) {
    list.push({
      id: 'dates',
      label: 'Use one date format (' + shape + ')',
      detail: 'Rewrites every start and end date into the convention for ' + region.name + '.',
      count: dateCount,
      run: (doc) => {
        let n = 0;
        const all = [];
        for (const it of doc.experience) all.push([it, 'start'], [it, 'end']);
        for (const it of doc.education) all.push([it, 'start'], [it, 'end']);
        for (const [it, k] of all) {
          const f = formatDate(parseDate(it[k]), shape);
          if (f && f !== it[k]) { it[k] = f; n += 1; }
        }
        return n;
      },
    });
  }

  /* --- bullet punctuation ------------------------------------------------ */
  const bulletLines = [];
  for (const it of d.experience) bulletLines.push(...String(it.bullets || '').split('\n').filter((x) => x.trim()));
  for (const it of d.projects) bulletLines.push(...String(it.bullets || '').split('\n').filter((x) => x.trim()));
  const withDot = bulletLines.filter((l) => /\.\s*$/.test(l)).length;
  const without = bulletLines.length - withDot;
  if (bulletLines.length > 3 && withDot && without) {
    const wantDot = withDot >= without;
    list.push({
      id: 'punctuation',
      label: wantDot ? 'End every bullet with a full stop' : 'Remove full stops from bullet ends',
      detail: 'Right now ' + withDot + ' end with one and ' + without + ' do not. Either is fine; '
        + 'being inconsistent is not.',
      count: wantDot ? without : withDot,
      run: (doc) => {
        let n = 0;
        for (const section of ['experience', 'projects']) {
          for (const it of doc[section]) {
            const before = it.bullets || '';
            const after = before.split('\n').map((l) => {
              const t = l.trim();
              if (!t) return l;
              if (wantDot) return /[.!?]$/.test(t) ? t : t + '.';
              return t.replace(/\.+$/, '');
            }).join('\n');
            if (after !== before) { it.bullets = after; n += 1; }
          }
        }
        return n;
      },
    });
  }

  return list;
}

/** Apply the chosen fixes to a deep copy; returns { data, applied }. */
export function applyFixes(d, ids) {
  const copy = JSON.parse(JSON.stringify(d));
  const chosen = availableFixes(d).filter((f) => ids.includes(f.id));
  const applied = [];
  for (const f of chosen) {
    const n = f.run(copy);
    if (n) applied.push({ id: f.id, label: f.label, count: n });
  }
  // Drop any line the fixes emptied out.
  for (const [section, field, single] of PROSE) {
    if (single) {
      copy.basics[single] = copy.basics[single].split('\n').filter((l) => l.trim()).join('\n');
      continue;
    }
    for (const item of copy[section] || []) {
      if (item[field]) item[field] = item[field].split('\n').filter((l) => l.trim()).join('\n');
    }
  }
  return { data: copy, applied };
}
