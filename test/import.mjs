import {
  parseCV,
  parseLinkedInArchive,
  looksLikeLinkedIn,
  unmojibake,
  parseSection,
  parseIdentity,
  recheck,
} from '../public/js/import.js';
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

/* --- did this CV read cleanly, and does it say so ----------------------- */
// There will always be a layout this cannot follow - one CV it was built
// against draws its headings as pictures. What must never happen is a silent
// miss: shown "Education - not found" and nothing else, a visitor concludes
// the site is broken.
console.log(NL + '=== the alignment verdict ===');

const clean2 = parseCV(j(
  'Priya Sharma', 'priya@example.com', '',
  'Experience', 'Engineer, Acme  Mar 2022 - Present', '• Cut load from 4.1s to 1.3s.', '',
  'Education', 'B.Tech, IIT Delhi  2014 - 2018'), blankData()).report.alignment;
check('a CV that reads is clean', clean2.level, 'clean');
check('and nothing is listed as missing', clean2.missing, []);
check('and no reason is invented', clean2.why, []);

const partial = parseCV(j(
  'Priya Sharma', 'priya@example.com', '',
  'Experience', 'Engineer, Acme  Mar 2022 - Present', '• Did the thing.'), blankData()).report.alignment;
check('one core section missing is partial', partial.level, 'partial');
check('and it is named', partial.missing, ['education']);

const poor = parseCV(j(
  'NEHAUMRANI', 'BACKEND JAVA DEVELOPER', 'neha@example.com',
  'I am a highly motivated Software Engineer eager to join a team of driven',
  'professionals, developing and maintaining backend systems and fixing bugs.'), blankData()).report.alignment;
check('two or more missing is poor', poor.level, 'poor');
check('both are named', poor.missing, ['work experience', 'education']);
check('with the reason that is actually evidenced',
  poor.why.some((w) => /No section headings were recognised/.test(w)), true);

// The bar for the scan reason was 400 characters, which fired on a real
// one-page CV and told its owner their pages might be pictures. A reason that
// is wrong is worse than no reason at all.
check('a short but real CV is not accused of being a scan',
  poor.why.some((w) => /image|scan/i.test(w)), false);

const scanned = parseCV('Resume', blankData()).report.alignment;
check('but a document with nothing in it is',
  scanned.why.some((w) => /image|scan/i.test(w)), true);

// Length alone was still too blunt once the flag moved to the top of the
// panel: this CV is 77 dense characters, well under the bar, and its owner
// pasted the text in by hand. Being told the pages might be pictures while
// the text is on screen is the fastest way to lose them.
const tiny = parseCV(j(
  'Priya Sharma', 'priya@example.com', '',
  'Experience', 'Engineer, Zenpay  Mar 2022 - Present', '• Did work.'),
  blankData()).report;
check('a very short CV with real contact details is not called a scan',
  tiny.alignment.why.some((w) => /image|scan/i.test(w)), false);
check('short though it is', tiny.dense < 150, true);

/* --- filling a gap the parser left ------------------------------------- */
// The commonest complaint about any CV importer: it says education is missing,
// the education is plainly there in the PDF, and the only thing on offer is to
// throw the whole import away. So the flag takes a paste of the part it could
// not find, runs it through the same section parser, and keeps everything it
// already got right.
console.log(NL + '=== filling a gap by hand ===');

const rescuedEdu = parseSection('education', j(
  'B.Tech Computer Science, IIT Delhi  2014 - 2018',
  'CGPA: 8.7/10',
  'Class XII, CBSE  2013',
  '92.4%'));
check('a pasted education block reads as entries', rescuedEdu.length, 2);
check('with the school split out', rescuedEdu[0].school, 'IIT Delhi');
check('and the dates', [rescuedEdu[0].start, rescuedEdu[0].end], ['2014', '2018']);
check('and the marks in the score field, not the details', rescuedEdu[0].score, 'CGPA: 8.7/10');

const rescuedExp = parseSection('experience', j(
  'Product Manager', 'Flipkart', 'June 2021 - August 2024',
  '\u2022 Owned the returns experience.'));
check('a pasted role reads the same way', rescuedExp.length, 1);
check('role and employer both', [rescuedExp[0].role, rescuedExp[0].company],
  ['Product Manager', 'Flipkart']);
check('and the bullet comes with it', rescuedExp[0].bullets, 'Owned the returns experience.');

check('nothing pasted, nothing invented', parseSection('education', '   '), []);
check('and an id that is not a section stays empty',
  parseSection('nonsense', 'Something'), []);

// A CV that lists its certifications under a heading nothing recognised leaves
// the same kind of hole as a missing education. Every section the importer can
// fill takes a paste, not just the four the flag is about.
console.log(NL + '--- every section, not just the core four ---');
const EVERY = [
  ['projects', 'Ledger app, React and Node', (o) => o.name === 'Ledger app' && o.tech === 'React and Node'],
  ['skills', 'Languages: Python, Go, SQL', (o) => o.group === 'Languages' && o.items === 'Python, Go, SQL'],
  ['certifications', 'AWS Certified Solutions Architect, Amazon   2023',
    (o) => o.issuer === 'Amazon' && o.year === '2023'],
  ['languages', 'English - fluent', (o) => o.name === 'English' && /fluent/i.test(o.level)],
  ['achievements', 'Won the internal hackathon, 2023', (o) => /hackathon/.test(o.text)],
  ['licences', 'Nursing registration, NMC 12345678', (o) => o.number === '12345678'],
  ['publications', 'A study of routing, Journal of Logistics, 2022', (o) => o.year === '2022'],
];
for (const [id, text, ok] of EVERY) {
  const got = parseSection(id, text);
  check(id + ' takes a paste', got.length, 1);
  check('  and reads its fields', got.length === 1 && ok(got[0]), true);
}

// The importer never produces a custom section - there is no heading it could
// recognise as "the one this site has no field for" - so this is the only way
// one arrives from an import at all.
const custom = parseSection('custom', j('Volunteering', 'Taught weekend coding classes.'));
check('a custom section is its heading and its body', custom,
  [{ heading: 'Volunteering', body: 'Taught weekend coding classes.' }]);

check('a typed name is read', parseIdentity('Ahmad Khan').fullName, 'Ahmad Khan');
const contact = parseIdentity('ahmad@example.com   +91 98765 43210');
check('and a contact line gives both',
  [contact.email, contact.phone], ['ahmad@example.com', '+91 98765 43210']);

// The verdict has to move when the gap is filled, or the flag stays up over a
// CV that is now complete and the visitor is told a lie twice.
const half = parseCV(j(
  'Priya Sharma', 'priya@example.com', '',
  'Experience', 'Engineer, Acme  Mar 2022 - Present', '\u2022 Did the thing.'),
  blankData());
check('before the rescue it is partial', half.report.alignment.level, 'partial');
check('and the gap carries an id the screen can act on',
  half.report.alignment.gaps.map((g) => g.id), ['education']);
half.data.education.push(...rescuedEdu);
check('after it, clean', recheck(half.data, half.report).level, 'clean');
check('and nothing is listed as missing', recheck(half.data, half.report).missing, []);

// Filling one gap of two must narrow the verdict rather than clear it. A flag
// that vanished at the first rescue would be telling someone their CV reads
// cleanly while half of it is still missing.
const both = parseCV(j(
  'Deepa Iyer', 'deepa@example.com', '',
  'Things I Have Done', 'Ran a 200-truck fleet for Maersk.', 'Rewrote the routing plan.'),
  blankData());
check('two gaps to start with', both.report.alignment.missing,
  ['work experience', 'education']);
both.data.experience.push(...parseSection('experience', 'Head of Logistics, Maersk  2018 - 2024'));
const half2 = recheck(both.data, both.report);
check('one rescue leaves the other gap standing', half2.missing, ['education']);
check('and drops the verdict from poor to partial', half2.level, 'partial');
both.data.education.push(...rescuedEdu);
check('the second clears it', recheck(both.data, both.report).level, 'clean');

/* --- a dot does not make it a website ----------------------------------- */
// Found the moment conversion became one press: "B.Tech" was landing in the
// website field and printing in the contact line next to the phone number.
// .tech, .sc, .com and .in are all real top-level domains, so an Indian
// qualification is indistinguishable from a hostname by shape. Tightening it
// then caught "Node.js" out of a skills list, which is the same bug wearing a
// different hat.
console.log(NL + '=== a dot does not make it a website ===');

const siteOf = (lines) => parseCV(j(...lines), blankData()).data.basics.website;

for (const [label, lines] of [
  ['a degree', ['Priya Sharma', 'priya@example.com', '', 'Education',
    'B.Tech Computer Science, IIT Delhi  2014 - 2018']],
  ['a masters', ['Rahul K', 'r@example.com', '', 'Education', 'M.Sc Physics, DU  2019']],
  ['a doctorate', ['Rahul K', 'r@example.com', '', 'Education', 'Ph.D Chemistry, IISc  2021']],
  ['a commerce degree', ['Rahul K', 'r@example.com', '', 'Education', 'B.Com, DU  2018']],
  ['a javascript library', ['Priya Sharma', 'priya@example.com', '', 'Skills',
    'React, Node.js, Vue.js']],
]) {
  check('not a website: ' + label, siteOf(lines), '');
}

// And the tightening must not cost anyone their actual site.
check('a real personal site still reads',
  siteOf(['Priya Sharma', 'priya@example.com', 'priya.dev', '', 'Education',
    'B.Tech, IIT Delhi  2014']), 'priya.dev');
check('one with a scheme is taken at its word',
  siteOf(['Priya Sharma', 'priya@example.com', 'https://p.co/work']), 'https://p.co/work');
check('and so is a www',
  siteOf(['Priya Sharma', 'priya@example.com', 'www.priya.in']), 'www.priya.in');

// A flat list of skills has no group name in it. Inventing one printed the
// word "Skills" twice on the CV - once as the section heading, once as a label
// underneath it.
const flat = parseCV(j('Priya Sharma', 'priya@example.com', '', 'Skills',
  'React, TypeScript, Node.js'), blankData()).data.skills;
check('one flat list of skills takes no invented group name',
  flat.map((g) => g.group), ['']);
check('but its items are all there', flat[0].items, 'React, TypeScript, Node.js');
const grouped = parseCV(j('Priya Sharma', 'priya@example.com', '', 'Skills',
  'Languages: Python, Go', 'Tools: Docker, K8s'), blankData()).data.skills;
check('real group names are kept', grouped.map((g) => g.group), ['Languages', 'Tools']);

/* --- a CV that titles itself ------------------------------------------- */
// "Profile of Soutrick Das" printed across the top of a converted CV, with
// "Confidential" underneath it where the job title goes. Both are things the
// document says about itself, and on Indian CVs both are ordinary.
console.log(NL + '=== what the document says about itself is not the person ===');

const who = (lines) => {
  const b = parseCV(j(...lines), blankData()).data.basics;
  return [b.fullName, b.headline];
};

check('Profile of, and Confidential under it',
  who(['Profile of Soutrick Das', 'Confidential', 'soutrickd5@example.com']),
  ['Soutrick Das', '']);
check('Resume of', who(['Resume of Rahul Mehta', 'rahul@example.com']), ['Rahul Mehta', '']);
check('Bio-Data of', who(['Bio-Data of Imran Sheikh', 'imran@example.com']), ['Imran Sheikh', '']);
check('a Name: label', who(['Name: Arjun Das', 'arjun@example.com']), ['Arjun Das', '']);
// A banner above the name must not become the name, and the real job title
// below it must still be found.
check('a Curriculum Vitae banner is stepped over',
  who(['CURRICULUM VITAE', 'Neha Gupta', 'Senior Nurse', 'neha@example.com']),
  ['Neha Gupta', 'Senior Nurse']);
check('an ordinary CV keeps its headline',
  who(['Priya Sharma', 'Senior Frontend Engineer', 'priya@example.com']),
  ['Priya Sharma', 'Senior Frontend Engineer']);

/* --- a date inside a sentence belongs to the sentence -------------------- */
// Cutting the year out of "Pursued B. Tech. in Electrical Engineering in 2018
// from Techno India." left "...Engineering in from Techno India." on a
// converted CV. The date is recorded either way; a sentence broken by a tool
// is one its owner may never notice.
console.log(NL + '=== a date in the middle of a sentence ===');

const edu = parseCV(j('Soutrick Das', 's@example.com', '', 'EDUCATIONAL QUALIFICATION:',
  '➢ Pursued B. Tech. in Electrical Engineering in 2018 from Techno India.',
  '➢ Pursued Higher Secondary from Kendriya Vidyalaya in 2014.'),
  blankData()).data.education;
check('the sentence is kept whole', edu[0].degree,
  'Pursued B. Tech. in Electrical Engineering in 2018 from Techno India.');
check('and the year is still recorded', edu[0].start, '2018');
check('a year at the end does not strand the preposition either', edu[1].degree,
  'Pursued Higher Secondary from Kendriya Vidyalaya in 2014.');
check('with its year too', edu[1].start, '2014');

// And an ordinary trailing date is still removed, which is the whole point of
// splitting them off in the first place.
const role = parseCV(j('A B', 'a@b.com', '', 'Experience',
  'Analyst, Deloitte Berlin  2019 - 2023', '• Did work.'), blankData()).data.experience[0];
check('a trailing range still comes off the title', [role.role, role.company],
  ['Analyst', 'Deloitte Berlin']);
check('and lands in the date fields', [role.start, role.end], ['2019', '2023']);

console.log(NL + (fails ? fails + ' FAILING' : 'all pass'));
process.exit(fails ? 1 : 0);
