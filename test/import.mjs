import { parseCV, parseLinkedInArchive, looksLikeLinkedIn, unmojibake } from '../public/js/import.js';
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

/* --- headings that letter-space, which a PDF hands back one char at a time - */
// A real CV that used this template imported as nothing at all: every heading
// arrived as "W O R K  E X P E R I E N C E", so none were recognised and the
// whole document went into the summary.
const SPACED = j(
  'C O N T A C T D E T A I L S', 'oupamya@example.com', '+91-9007919036',
  'P R O F I L E S U M M A R Y', 'Seven years in mainframe development.',
  'T E C H N I C A L S K I L L S', 'COBOL, JCL, DB2',
  'W O R K E X P E R I E N C E',
  'Lead Developer Nov 2017-Nov 2023', 'Built things that mattered.',
  'E D U C A T I O N', 'BSc Computer Science 2013 - 2017');

console.log(NL + '=== letter-spaced headings ===');
const sp = parseCV(SPACED, blankData()).data;
check('summary read', sp.basics.summary.includes('mainframe development'), true);
check('experience found', sp.experience.length > 0, true);
check('skills found', sp.skills.length > 0, true);
check('education found', sp.education.length > 0, true);
// The spaced heading is short enough to pass every headline test, and on a
// template whose sidebar prints first it is the very first line in the file.
check('a heading never becomes the headline', sp.basics.headline, '');
check('contact block did not become a section',
  JSON.stringify(sp.skills).includes('C O N T A C T'), false);

// Initials and acronyms must not turn into sections just by being spaced out.
const notHeadings = parseCV(j('J R R T O L K I E N', 'A B C D E F', 'Some text.'), blankData()).data;
check('a spaced name is not a section', notHeadings.experience.length, 0);

/* --- jobs written as blocks of Label : Value ---------------------------- */
// Common on Indian CVs. The generic splitter opened a new job at
// "Responsibilities:" - short line, bullet underneath - so one job became four
// and the employer was never read at all.
const LABELLED = j(
  'Work Experience',
  'Current organization:',
  'Entity : Deloitte Consulting PVT. LTD.',
  'Role : Consultant',
  'Dec 2023 - Present',
  'Location: Kolkata, India',
  'Project :',
  'Modernising mainframe legacy applications for an investment bank.',
  'TECHNOLOGIES USED: Cobol, JCL, DB2',
  'Responsibilities:',
  '• Gathering requirements and representing the team in client meetings.',
  '• Estimating and planning tasks with the architect.',
  'Previous Organization:',
  'Company: Tata Consultancy Services LTD',
  'Role: Lead Developer and Subject Matter Expert',
  'Nov 2017-Nov 2023',
  'Location: Kolkata, India',
  'Responsibilities:',
  '• Developed additional modules for existing applications.');

console.log(NL + '=== jobs written as Label : Value ===');
const lab = parseCV(LABELLED, blankData()).data.experience;
check('two jobs, not one per label', lab.length, 2);
check('employer read', lab.map((e) => e.company),
  ['Deloitte Consulting PVT. LTD.', 'Tata Consultancy Services LTD']);
check('title read', lab.map((e) => e.role),
  ['Consultant', 'Lead Developer and Subject Matter Expert']);
check('location read', lab[0].location, 'Kolkata, India');
check('dates read', [lab[0].start, lab[0].current], ['Dec 2023', true]);
check('closed range read', [lab[1].start, lab[1].end], ['Nov 2017', 'Nov 2023']);
check('detail kept as bullets', lab[0].bullets.includes('client meetings'), true);
// "Responsibilities:" would repeat on every entry and says nothing.
check('divider labels dropped', lab[0].bullets.includes('Responsibilities'), false);
check('technologies kept', lab[0].bullets.includes('Cobol, JCL, DB2'), true);

// The ordinary layout must still take the ordinary path.
const plainExp = parseCV(j('Experience', 'Senior Engineer, Acme Mar 2021 - Jul 2024',
  '• Did the thing.'), blankData()).data.experience;
check('unlabelled CVs unaffected', plainExp.length, 1);
check('unlabelled dates still split', [plainExp[0].start, plainExp[0].end], ['Mar 2021', 'Jul 2024']);

/* --- a name that sits well down the page ------------------------------- */
// Where the sidebar is printed before the header, the name is nowhere near the
// top of the extracted text, and the CV imported with an empty header - the
// checker then reported a missing name that was plainly on the PDF.
const SIDEBAR = j(
  'C O N T A C T D E T A I L S',
  '+91-9007919036',
  'oupamyabanerjee@gmail.com',
  'C O R E C O M P E T E N C I E S',
  'Mainframe Application Development',
  'OUPAMYA BANERJEE',
  'P R O F I L E S U M M A R Y',
  'Seven years in mainframe development.');

console.log(NL + '=== a name below the fold ===');
const sb = parseCV(SIDEBAR, blankData()).data.basics;
check('found via the email', sb.fullName, 'OUPAMYA BANERJEE');
check('email still read', sb.email, 'oupamyabanerjee@gmail.com');

// It has to match the address, not merely look like a name. Guessing from
// capitalisation would decide this person is called Technologies Used.
const noMatch = parseCV(j('C O N T A C T', 'someone@example.com',
  'W O R K E X P E R I E N C E', 'TECHNOLOGIES USED', 'Cobol and JCL'), blankData()).data.basics;
check('no name invented when nothing matches', noMatch.fullName, '');

// A name at the top still wins - the search below it is only a fallback.
const topName = parseCV(j('Priya Sharma', 'unrelated.address@example.com',
  'Experience', 'Engineer 2020 - 2024'), blankData()).data.basics;
check('a name at the top still wins', topName.fullName, 'Priya Sharma');

// first.last@ reduces to the same letters once the punctuation goes.
const dotted = parseCV(j('C O N T A C T', 'asha.rahman@corp.com',
  'S U M M A R Y', 'Asha Rahman', 'A nurse.'), blankData()).data.basics;
check('dotted addresses match too', dotted.fullName, 'Asha Rahman');

/* --- UTF-8 read one byte at a time --------------------------------------- */
// A content stream is bytes, so reading it as bytes is the only way to find the
// operators in it - and a generator that writes UTF-8 into a simple font's
// strings then hands back one character per byte.
console.log(NL + '=== mojibake ===');

// U+27A2, the arrow Word uses for bullets, is E2 9E A2 in UTF-8. Byte 0x9E
// comes back as U+017E, which is why a plain Latin-1 reverse is not enough.
check('a Word bullet is put back together',
  unmojibake('âž¢ Pursued B. Tech.'), '➢ Pursued B. Tech.');
check('and the small square bullet',
  unmojibake('â–ª Item'), '▪ Item');
check('an accented name survives',
  unmojibake('JosÃ© GarcÃ­a'), 'José García');

// The dangerous direction: text that is already correct must come back
// untouched, and anything that is not valid UTF-8 must be left exactly alone.
check('plain ASCII is untouched', unmojibake('Plain text.'), 'Plain text.');
check('real Unicode is untouched',
  unmojibake('भारत — India'), 'भारत — India');
check('an accent that is not mojibake is left alone',
  unmojibake('Café manager'), 'Café manager');
check('a lone lead byte is not mangled',
  unmojibake('Â alone'), 'Â alone');

/* --- headings the parser does not know ----------------------------------- */
// No table holds every name a CV gives its sections, so the ones it cannot
// place are reported instead of silently folded into the section above.
console.log(NL + '=== unrecognised headings ===');

const REPORTED = parseCV(j(
  'Ravi Kumar', 'ravi@example.com', '',
  'CAREER ABSTRACT:', 'Ten years in logistics.', '',
  'WORK EXPOSURE:', 'Ops Manager, Blue Dart  2016 - 2024', '• Ran a depot.', '',
  'SCHOLASTIC RECORD:', 'B.Com, Delhi University  2012 - 2015', '',
  'COMPUTER PROFICIENCY:', 'Excel, SAP', '',
  'SOMETHING WE HAVE NEVER SEEN:', 'Mystery content.', '',
  'DECLARATION:', 'All true.'), blankData());

// The widened table should place all of these without help.
check('career abstract read as a summary',
  REPORTED.data.basics.summary.includes('logistics'), true);
check('work exposure read as experience', REPORTED.data.experience.length, 1);
check('scholastic record read as education', REPORTED.data.education.length, 1);
check('computer proficiency read as skills', REPORTED.data.skills.length > 0, true);

check('the one it cannot place is named',
  REPORTED.report.unknownHeadings, ['SOMETHING WE HAVE NEVER SEEN']);
check('a recognised heading is never reported',
  REPORTED.report.unknownHeadings.some((h) => /SCHOLASTIC|EXPOSURE|ABSTRACT/.test(h)), false);
check('declaration is dropped, not reported',
  REPORTED.report.unknownHeadings.includes('DECLARATION'), false);

// The noise this must not produce, all of it seen on real CVs.
const QUIET = parseCV(j(
  'Experience', 'Engineer, Acme  2020 - 2024', '• Did the thing.',
  'Skills', 'COBOL', 'JCL', 'IMS'), blankData()).report.unknownHeadings;
check('single capitalised words are not headings', QUIET, []);

// A capitalised line directly above a real heading has nothing under it - on a
// sidebar-first CV that line is the person's own name, halfway down the page.
const SIDEBAR_UNKNOWN = parseCV(j(
  'Skills', 'COBOL, JCL', 'OUPAMYA BANERJEE', 'Summary', 'Seven years.'),
  blankData()).report.unknownHeadings;
check('a name above a heading is not reported', SIDEBAR_UNKNOWN, []);

console.log(NL + (fails ? fails + ' FAILING' : 'all pass'));
process.exit(fails ? 1 : 0);
