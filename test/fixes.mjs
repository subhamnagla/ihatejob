// The automatic clean-up, and the line it must not cross.
//
// This file exists because the fixer was quietly mangling real CVs: it turned
// "adept at handling fast-paced environments" into "can handling fast-paced
// environments" and "with a proven track record in the realm of digital
// marketing" into "of digital marketing". Every case below was produced by the
// shipped code before it was fixed.
//
// The rule under all of it: a fix must be mechanical. Where a phrase can only
// be improved by changing the verb after it, the fixer declines and the checker
// reports it instead - because bad grammar on a CV is worse than filler, and a
// tool that silently rewrites someone's history into nonsense is worse again.

import { availableFixes, applyFixes } from '../public/js/fixes.js';
import { checkPhrases } from '../public/js/review.js';
import { blankData } from '../public/js/schema.js';

const NL = String.fromCharCode(10);
let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails += 1; console.log('FAIL  ' + label + NL + '        want ' + JSON.stringify(want) + NL + '        got  ' + JSON.stringify(got)); }
  else console.log('ok    ' + label);
};

const flagged = (t) => checkPhrases(t).length > 0;

function clean(line) {
  const d = blankData();
  d.basics.summary = line;
  const out = applyFixes(d, availableFixes(d).map((f) => f.id));
  return ((out.data || out).basics.summary || '').trim();
}

console.log('=== fixes that are safe to make ===');
check('leveraged', clean('Leveraged Docker to ship faster.'), 'Used Docker to ship faster.');
check('spearheaded', clean('Spearheaded the migration.'), 'Led the migration.');
check('empty adjectives go', clean('Built a robust, seamless pipeline.'), 'Built a pipeline.');
check('vague adverbs go', clean('Significantly improved delivery times.'), 'Improved delivery times.');
check('the article comes with the quantifier',
  clean('Delivered campaigns across a myriad of channels.'),
  'Delivered campaigns across many channels.');
check('and with plethora too',
  clean('Leveraged a plethora of tools to significantly improve delivery.'),
  'Used many tools to improve delivery.');

console.log(NL + '=== the subject matter is not filler ===');
// A filler clause is cut only where the clause ends. Here "in the realm of
// digital marketing" hangs off it, and cutting the one strands the other - so
// the empty adjectives go and the phrase itself stays, reported rather than
// rewritten. Earlier this produced "A professional in the realm of digital
// marketing", which read well until the same rule met "with a proven track
// record of delivery across three teams" and returned "An engineer across
// three teams".
check('what the person actually does survives',
  clean('A results-driven professional with a proven track record in the realm of digital marketing.'),
  'A professional with a track record in the realm of digital marketing.');
check('and the phrase is still reported',
  checkPhrases('A professional with a track record in the realm of digital marketing.').length > 0, true);
// "An engineer with a proven track record of success." is filler end to end,
// and cutting the filler leaves two words. The guard reverts that rather than
// hand someone a summary reading "An engineer." - which is the right call: the
// line is not improved by being emptied, and the checker still reports it.
const allFiller = 'An engineer with a proven track record of success.';
check('a line that is filler throughout is left, not emptied', clean(allFiller), allFiller);
check('and reported instead', checkPhrases(allFiller).length > 0, true);

// With real content hanging off it, nothing is cut but the empty adjective.
check('a clause with content after it is left whole',
  clean('An engineer with a proven track record of success across payments systems.'),
  'An engineer with a track record of success across payments systems.');

console.log(NL + '=== cutting filler must not strand what follows it ===');
// Every line here was mangled by the version that removed a filler clause
// wherever it found one. The clause is empty; the phrase after it is the
// subject matter, and removing the first orphans the second.
const STRANDED = [
  ['With a passion for full-stack development, I am an experienced Java Developer.',
    'Full-stack development, I am an experienced Java Developer.'],
  ['An engineer with a demonstrated ability to lead teams and ship features.',
    'An engineer to lead teams and ship features.'],
  ['A developer with a passion for distributed systems and clean code.',
    'A developer distributed systems and clean code.'],
  ['An engineer with a wealth of experience in distributed systems.',
    'An engineer in distributed systems.'],
  ['An engineer with a proven track record of delivery across three teams.',
    'An engineer across three teams.'],
];
for (const [line, wasProduced] of STRANDED) {
  check('never returns: ' + wasProduced.slice(0, 38), clean(line) === wasProduced, false);
  check('  and still reports it: ' + line.slice(0, 30), flagged(line), true);
}

console.log(NL + '=== rewrites that need the verb to change are declined ===');
for (const line of [
  'Adept at handling fast-paced environments and competing deadlines.',
  'Well-versed in Python and SQL.',
  'I am well-versed in stakeholder management.',
]) {
  check('left alone: ' + line.slice(0, 34), clean(line), line);
}

console.log(NL + '=== but the checker still reports them ===');
check('adept at', flagged('Adept at handling fast-paced environments.'), true);
check('well-versed in', flagged('I am well-versed in stakeholder management.'), true);
check('navigated the complexities', flagged('Navigated the complexities of migration.'), true);
check('navigate the complexities', flagged('Navigate the complexities of migration.'), true);

console.log(NL + '=== the guard catches what it could not see before ===');
// Each of these is a real former output. None is empty, none is short, none
// starts with a bare auxiliary - the three things the guard used to test.
const NONSENSE = [
  'Can handling fast-paced environments and competing deadlines.',
  'Delivered campaigns across a many channels.',
  'I am know stakeholder management.',
  'A professional with in the realm of digital marketing.',
];
for (const bad of NONSENSE) {
  // Whatever the fixer does to a line, it must never produce one of these.
  check('never emits: ' + bad.slice(0, 34), clean(bad) === bad || !/\b(?:can|could|will)\s+\w+ing\b|\b(?:a|an)\s+many\b|\bam\s+know\b|\bwith\s+in\b/.test(clean(bad)), true);
}

console.log(NL + '=== a line already broken keeps its own fixes ===');
// The guard blames a rewrite only for breakage it introduced. Someone whose
// original already reads badly should still get the safe substitutions.
const already = clean('Leveraged the the robust system.');
check('pre-existing oddity does not block every fix', already.includes('Used'), true);

console.log(NL + '=== nothing is invented ===');
check('an empty CV stays empty', clean(''), '');
check('a clean line is untouched',
  clean('Cut deployment time from 40 minutes to 6.'),
  'Cut deployment time from 40 minutes to 6.');

console.log(NL + (fails ? fails + ' FAILING' : 'all pass'));
process.exit(fails ? 1 : 0);
