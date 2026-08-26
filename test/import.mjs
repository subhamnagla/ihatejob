import { parseCV, parseLinkedInArchive, looksLikeLinkedIn } from '../public/js/import.js';
import { blankData } from '../public/js/schema.js';

const NL = String.fromCharCode(10);
const j = (...a) => a.join(NL);
let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails += 1; console.log('FAIL  ' + label + NL + '        want ' + JSON.stringify(want) + NL + '        got  ' + JSON.stringify(got)); }
  else console.log('ok    ' + label);
};

/* --- the shape LinkedIn prints for a single-role company ---------------- */
const A = j(
  '   Contact', 'www.linkedin.com/in/priya-sharma-1a2b3c', '(LinkedIn)', 'priya.sharma@example.com',
  '', 'Top Skills', 'Search Engine Optimization (SEO)', 'Google Ads',
  '', 'Languages', 'Hindi (Native or Bilingual)',
  '', 'Certifications', 'Google Analytics IQ',
  '', 'Priya Sharma', 'Digital Marketing Manager at Acme Media', 'Bengaluru, Karnataka, India',
  '', 'Summary', 'Results-driven professional.',
  '', 'Experience', 'Acme Media', 'Digital Marketing Manager',
  'March 2021 - Present', '(3 years 5 months)', 'Bengaluru, Karnataka, India',
  'Responsible for managing social media accounts',
  '', 'Education', 'Christ University', 'BBA, Marketing', '· (2014 - 2017)',
  '', 'Page', '1', 'of', '2');

console.log('=== single-role company ===');
console.log('detected:', looksLikeLinkedIn(A));
const a = parseCV(A, blankData());
check('name', a.data.basics.fullName, 'Priya Sharma');
check('headline', a.data.basics.headline, 'Digital Marketing Manager at Acme Media');
check('location', a.data.basics.location, 'Bengaluru, Karnataka, India');
check('email', a.data.basics.email, 'priya.sharma@example.com');
check('skills', (a.data.skills[0] || {}).items, 'Search Engine Optimization (SEO), Google Ads');
check('language level', (a.data.languages[0] || {}).level, 'Native');
check('roles', a.data.experience.length, 1);
check('role/company', a.data.experience[0].role + '@' + a.data.experience[0].company,
  'Digital Marketing Manager@Acme Media');
check('current', a.data.experience[0].current, true);
check('bullets', a.data.experience[0].bullets, 'Responsible for managing social media accounts');
check('duration not a bullet', a.data.experience[0].bullets.includes('3 years'), false);
check('education', a.data.education.map((e) => e.degree + '@' + e.school), ['BBA, Marketing@Christ University']);

/* --- multi-role company, wrapped headline, wrapped description ---------- */
const B = j(
  '   Contact', 'www.linkedin.com/in/subham-', 'nagla-074334145', '(LinkedIn)', 'sub@example.com',
  '', 'Top Skills', 'AWS', 'MySQL', 'REST APIs',
  '', 'Subham Nagla', 'Consultant at Deloitte |Java Backend|Spring Boot|', 'MsSql|Oracle',
  'Kolkata, West Bengal, India',
  '', 'Summary', 'Currently a Software Engineer.',
  '', 'Experience', 'Deloitte', 'Consultant', 'November 2024 - Present', '(1 year 10 months)',
  'Hyderabad, Telangana, India',
  'Cognizant', '3 years 5 months', 'Software Engineer', 'January 2024 - November 2024',
  '(11 months)', 'Kolkata, West Bengal, India',
  'Java 8,11,17 | Rest Web Service | MySQL |', 'Oracle',
  'Junior Software Engineer', 'July 2021 - January 2024', '(2 years 7 months)',
  'Kolkata, West Bengal, India',
  '', 'Education', 'Techno Main - Salt Lake', 'Bachelor of Technology - BTech, Electronics',
  'and Communication Engineering', '· (July 2017 - July 2021)',
  'Techno Main - Salt Lake', 'Bachelor of Technology - BTech, Electronics',
  'and Communication Engineering', '· (July 2017 - July 2021)',
  '', 'Page', '1', 'of', '2');

console.log(NL + '=== multi-role company, wrapped lines ===');
const b = parseCV(B, blankData());
check('name', b.data.basics.fullName, 'Subham Nagla');
check('headline rejoined', b.data.basics.headline,
  'Consultant at Deloitte |Java Backend|Spring Boot| MsSql|Oracle');
check('location', b.data.basics.location, 'Kolkata, West Bengal, India');
check('url unwrapped', b.data.basics.linkedin, 'www.linkedin.com/in/subham-nagla-074334145');
check('skills not eaten by identity', (b.data.skills[0] || {}).items, 'AWS, MySQL, REST APIs');
check('roles', b.data.experience.length, 3);
check('companies', b.data.experience.map((e) => e.company), ['Deloitte', 'Cognizant', 'Cognizant']);
check('wrapped description kept', b.data.experience[1].bullets.split(NL).length, 2);
check('no page furniture', JSON.stringify(b.data).includes('"of"'), false);
check('education deduped', b.data.education.length, 1);
check('degree rejoined', b.data.education[0].degree,
  'Bachelor of Technology - BTech, Electronics and Communication Engineering');

/* --- guardrails --------------------------------------------------------- */
console.log(NL + '=== guardrails ===');
const plain = j('Jane Doe', 'jane@example.com', '', 'Experience', 'Acme Ltd - Engineer', '2020 - 2023', '• Did things');
check('plain CV not misdetected', looksLikeLinkedIn(plain), false);
check('empty LinkedIn falls back',
  parseCV(j('www.linkedin.com/in/x', '(LinkedIn)', 'Top Skills', 'Nothing'), blankData()).report.source,
  undefined);

/* --- archive ------------------------------------------------------------ */
console.log(NL + '=== archive ===');
const c = parseLinkedInArchive({
  'profile.csv': j('First Name,Last Name,Headline,Summary,Geo Location',
    'Priya,Sharma,"Manager","Line one.' + NL + NL + 'Line two.","Bengaluru, India"'),
  'positions.csv': j('Company Name,Title,Description,Location,Started On,Finished On',
    '"Acme","Manager","Did a thing' + NL + '• Did another","Bengaluru","Mar 2021",'),
  'languages.csv': j('Name,Proficiency', 'Hindi,Native or bilingual proficiency'),
  'messages.csv': j('CONVERSATION ID,CONTENT', '1,private'),
}, blankData());
check('name', c.data.basics.fullName, 'Priya Sharma');
check('multiline bullets', c.data.experience[0].bullets, 'Did a thing' + NL + 'Did another');
check('current from empty end', c.data.experience[0].current, true);
check('language level', c.data.languages[0].level, 'Native');
check('messages ignored', JSON.stringify(c.data).includes('private'), false);
check('files named', c.report.read.includes('messages.csv'), false);

/* --- date tokens must not match inside words --------------------------- */
console.log(NL + '=== date tokens ===');
const withLine = (line) => {
  const t = j('Jane Doe', 'jane@example.com', '', 'Experience', line, '- Did a thing');
  return parseCV(t, blankData()).data.experience[0] || {};
};
// "now" inside "knowledge" and "current" inside "concurrent" were being cut
// out of the middle of the word by the date splitter.
check('knowledge survives', withLine('Acquired in-depth knowledge through coursework').role,
  'Acquired in-depth knowledge through coursework');
check('concurrent survives', withLine('Ran concurrent workloads across nodes').role,
  'Ran concurrent workloads across nodes');
const dated = (line) => {
  const e = withLine(line);
  return (e.start || '') + '|' + (e.end || '');
};
check('slash dates still split', dated('Consultant 11/2024 - Present'), '11/2024|');
check('month dates still split', dated('Engineer Mar 2021 - Jul 2024'), 'Mar 2021|Jul 2024');
check('bare "now" still splits', dated('Engineer 2021 - now'), '2021|');

console.log(NL + (fails ? fails + ' FAILING' : 'all pass'));
process.exit(fails ? 1 : 0);
