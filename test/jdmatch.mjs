// Matching a CV against a job advert. The failure that matters here is not
// missing a term - it is claiming a match that is not there, because someone
// then applies believing their CV says something it does not.

import { matchJD } from '../public/js/jdmatch.js';

const NL = String.fromCharCode(10);
const j = (...a) => a.join(NL);
let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails += 1; console.log('FAIL  ' + label + '  want ' + JSON.stringify(want) + ', got ' + JSON.stringify(got)); }
  else console.log('ok    ' + label);
};

const JD = j(
  'Senior Backend Engineer - Bengaluru',
  '',
  'Requirements',
  '- 5+ years building services in Python',
  '- Strong PostgreSQL and SQL',
  '- Experience with Docker and Kubernetes',
  '- Must have AWS exposure',
  '',
  'Nice to have',
  '- Terraform',
  '- Kafka',
  '',
  'You will join a fast-paced team of excellent communicators.');

const CV = j(
  'Arjun Das - Backend Engineer',
  'Built services in Python and Go.',
  'Designed PostgreSQL schemas and tuned SQL queries.',
  'Deployed with Docker on AWS.');

const r = matchJD(JD, CV);
const term = (t) => r.terms.find((x) => x.term === t);

console.log('=== what the advert asks for ===');
check('python found', Boolean(term('python') && term('python').found), true);
check('postgresql found', Boolean(term('postgresql') && term('postgresql').found), true);
check('docker found', Boolean(term('docker') && term('docker').found), true);
check('aws found', Boolean(term('aws') && term('aws').found), true);

console.log(NL + '=== what is missing ===');
const missing = r.missing.map((m) => m.term);
check('kubernetes missing', missing.includes('kubernetes'), true);
check('terraform missing', missing.includes('terraform'), true);
check('kafka missing', missing.includes('kafka'), true);
check('nothing present is listed as missing',
  r.missing.some((m) => m.found), false);

console.log(NL + '=== how strongly it is asked for ===');
check('requirements are must', term('kubernetes').weight, 'must');
check('nice-to-haves are nice', term('terraform').weight, 'nice');
check('inline "must have" counts', term('aws').weight, 'must');

console.log(NL + '=== filler is not a requirement ===');
const junk = ['team player', 'fast paced', 'fast-paced', 'excellent communication', 'communication'];
check('advert filler dropped', r.terms.filter((t) => junk.includes(t.term)).length, 0);
check('stopwords dropped', r.terms.filter((t) => ['the', 'with', 'years', 'experience'].includes(t.term)).length, 0);

console.log(NL + '=== the count is honest ===');
check('covered never exceeds total', r.covered <= r.total, true);
check('covered counts only found terms', r.covered,
  r.terms.filter((t) => t.weight !== 'body' && t.found).length);
check('a verdict in words, not a percentage', /%/.test(r.verdict), false);
check('terms are always returned', r.terms.length > 0, true);

console.log(NL + '=== it must not invent matches ===');
const empty = matchJD(JD, 'I once walked past a data centre.');
check('an unrelated CV matches almost nothing', empty.covered <= 1, true);
check('and says so plainly', /little/i.test(empty.verdict), true);

// "engineers" in a CV should satisfy "engineer" in an advert, but "java" must
// never be satisfied by "javascript" - that is the mistake that matters.
console.log(NL + '=== near misses ===');
const plural = matchJD('Requirements\n- Kubernetes engineers', 'I am an engineer using Kubernetes.');
check('plural forms match', plural.covered >= 1, true);
const jj = matchJD('Requirements\n- Java', 'Skilled in JavaScript.');
check('java is not matched by javascript',
  Boolean(jj.terms.find((t) => t.term === 'java' && t.found)), false);

console.log(NL + '=== nothing to read ===');
const none = matchJD('', 'A CV.');
check('an empty advert is refused, not scored', none.total, 0);
check('and says why', /too short/i.test(none.verdict), true);

console.log(NL + '=== a real-shaped advert ===');
const nurse = matchJD(j(
  'Staff Nurse - Acute Medical Unit',
  'Essential',
  '- NMC registration',
  '- Acute medical experience',
  '- ALS certification',
  'Desirable',
  '- Mentorship qualification'),
j('Staff Nurse with NMC registration 12A3456.',
  'Six years on an acute medical unit.'));
check('registration matched', nurse.covered >= 1, true);
check('ALS listed as missing', nurse.missing.some((m) => m.term === 'als'), true);

console.log(NL + (fails ? fails + ' FAILING' : 'all pass'));
process.exit(fails ? 1 : 0);
