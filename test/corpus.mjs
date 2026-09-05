// A scorecard for the importer, across the layouts CVs are actually written in.
//
// Every fix before this one was reactive: a real CV came back wrong, it got
// patched, a test was added for that CV. That finds bugs one person at a time
// and never says how much of the problem is left.
//
// This is the same idea run forwards. Each fixture is one layout family, given
// as the text a PDF hands back after extraction - which is the layer that
// actually varies. Extraction itself is solid; recognition is where CVs differ.
//
// Two kinds of expectation:
//   must  asserted. A break here fails the build.
//   want  reported only. Known gaps, listed honestly rather than hidden.
//
// Fixing a `want` means promoting it to `must` in the same commit, so the
// scorecard can only ever move forwards.

import { parseCV } from '../public/js/import.js';
import { blankData } from '../public/js/schema.js';

const NL = String.fromCharCode(10);
const j = (...a) => a.join(NL);

const FIXTURES = [
  {
    name: 'plain single column',
    why: 'The baseline. Headings on their own line, title and employer together.',
    text: j(
      'Priya Sharma',
      'Senior Frontend Engineer',
      'priya@example.com | +91 98765 43210 | Bengaluru, India',
      '',
      'Summary',
      'Frontend engineer with six years building customer-facing products.',
      '',
      'Experience',
      'Senior Frontend Engineer, Zenpay  Mar 2022 - Present',
      '• Rebuilt checkout in React, cutting load from 4.1s to 1.3s.',
      '• Led a team of four.',
      '',
      'Education',
      'B.Tech Computer Science, IIT Delhi  2014 - 2018',
      '',
      'Skills',
      'React, TypeScript, Node.js'),
    must: { name: 'Priya Sharma', email: 'priya@example.com', exp: 1, edu: 1, skills: true, company: 'Zenpay', start: 'Mar 2022' },
  },

  {
    name: 'letter-spaced headings',
    why: 'Tracking on headings; a PDF returns one character at a time.',
    text: j(
      'C O N T A C T',
      'asha@example.com',
      'P R O F I L E   S U M M A R Y',
      'Staff nurse with eight years on acute wards.',
      'W O R K   E X P E R I E N C E',
      'Staff Nurse, NHS Trust  Jan 2019 - Present',
      '• Ran a 28-bed ward.',
      'E D U C A T I O N',
      'BSc Nursing, University of Leeds  2012 - 2015'),
    must: { email: 'asha@example.com', exp: 1, edu: 1, summaryHas: 'acute wards' },
  },

  {
    name: 'labelled blocks',
    why: 'Common on Indian CVs: each job is Entity / Role / Duration lines.',
    text: j(
      'Work Experience',
      'Current organization:',
      'Entity : Deloitte Consulting',
      'Role : Consultant',
      'Dec 2023 - Present',
      'Location: Kolkata, India',
      'Responsibilities:',
      '• Gathered requirements.',
      'Previous Organization:',
      'Company: Tata Consultancy Services',
      'Role: Lead Developer',
      'Nov 2017-Nov 2023',
      '• Built modules.'),
    must: { exp: 2, company: 'Deloitte Consulting', role: 'Consultant', start: 'Dec 2023' },
  },

  {
    name: 'sidebar printed first',
    why: 'Two-column template: the name arrives long after the contact block.',
    text: j(
      'C O N T A C T',
      'oupamyabanerjee@gmail.com',
      'S K I L L S',
      'COBOL, JCL',
      'OUPAMYA BANERJEE',
      'S U M M A R Y',
      'Seven years in mainframe development.'),
    must: { name: 'OUPAMYA BANERJEE' },
  },

  {
    name: 'dates on their own line',
    why: 'Title, then employer, then the range underneath - very common.',
    text: j(
      'Rahul Mehta',
      'rahul@example.com',
      '',
      'EXPERIENCE',
      'Product Manager',
      'Flipkart',
      'June 2021 - August 2024',
      '• Owned the returns experience.',
      '• Cut refund time from 9 days to 4.',
      '',
      'EDUCATION',
      'MBA',
      'IIM Bangalore',
      '2019 - 2021'),
    must: { name: 'Rahul Mehta', exp: 1, edu: 1, role: 'Product Manager', company: 'Flipkart', start: 'June 2021' },
  },

  {
    name: 'headings with rules',
    why: 'ALL CAPS headings followed by a line of dashes or underscores.',
    text: j(
      'Sana Iqbal',
      'sana@example.com',
      '',
      'PROFESSIONAL EXPERIENCE',
      '________________________',
      'Marketing Manager, Unilever  2020 - 2024',
      '• Ran a team of six.',
      '',
      'EDUCATION',
      '________________________',
      'BA Economics, Delhi University  2016 - 2019'),
    must: { name: 'Sana Iqbal', exp: 1, edu: 1 },
  },

  {
    name: 'unusual bullet characters',
    why: 'Arrows, ticks and chevrons instead of round bullets.',
    text: j(
      'Vikram Rao',
      'vikram@example.com',
      '',
      'Experience',
      'Site Engineer, L&T  2019 - 2023',
      '→ Supervised 40 workers on a metro contract.',
      '✓ Cut rework by a fifth.',
      '▸ Reported to the project director.'),
    must: { name: 'Vikram Rao', exp: 1, bullets: 3, cleanBullets: true },
  },

  {
    name: 'company first, role second',
    why: 'The order LinkedIn prints, and plenty of CVs copy it.',
    text: j(
      'Meera Nair',
      'meera@example.com',
      '',
      'Experience',
      'Infosys',
      'Systems Engineer',
      'July 2018 - March 2022',
      '• Maintained payment batch jobs.'),
    must: { name: 'Meera Nair', exp: 1, company: 'Infosys', role: 'Systems Engineer' },
  },

  {
    name: 'skills grouped by category',
    why: '"Languages: ..." / "Tools: ..." rather than one flat list.',
    text: j(
      'Arjun Das',
      'arjun@example.com',
      '',
      'Technical Skills',
      'Languages: Python, Go, SQL',
      'Frameworks: Django, FastAPI',
      'Tools: Docker, Kubernetes, Terraform',
      '',
      'Experience',
      'Backend Engineer, Swiggy  2020 - 2024',
      '• Ran the order service.'),
    must: { name: 'Arjun Das', skills: true, exp: 1, skillGroups: 3 },
  },

  {
    name: 'education with marks',
    why: 'CGPA and percentage lines, which belong in the score field.',
    text: j(
      'Neha Gupta',
      'neha@example.com',
      '',
      'Education',
      'B.E. Mechanical Engineering, VTU  2015 - 2019',
      'CGPA: 8.7/10',
      'Class XII, CBSE  2015',
      '92.4%'),
    must: { name: 'Neha Gupta', edu: 2, score: true },
  },

  {
    name: 'en dash and no space',
    why: 'Ranges written 2019–2023 with a dash and nothing either side.',
    text: j(
      'Imran Sheikh',
      'imran@example.com',
      '',
      'Experience',
      'Analyst, Deloitte 2019–2023',
      '• Built dashboards.'),
    must: { name: 'Imran Sheikh', exp: 1, start: '2019', end: '2023' },
  },

  {
    name: 'headings the parser has not met',
    why: 'Real headings that are not in the name table, e.g. Career Snapshot.',
    text: j(
      'Deepa Iyer',
      'deepa@example.com',
      '',
      'Career Snapshot',
      'Twelve years in supply chain.',
      '',
      'Employment Record',
      'Head of Logistics, Maersk  2018 - 2024',
      '• Ran a 200-truck fleet.'),
    must: { name: 'Deepa Iyer', exp: 1, summaryHas: 'supply chain' },
  },

  {
    name: 'singular heading, and a bulleted list section',
    why: '"Educational Qualification:" is as common as the plural, and each line'
      + ' is its own qualification rather than detail under the first.',
    text: j(
      'Soutrick Das',
      'soutrick@example.com',
      '',
      'EXPERIENCE:',
      'Programmer Analyst, Cognizant  Sep 2018 - Feb 2022',
      '➢ Wrote COBOL batch jobs.',
      '',
      'EDUCATIONAL QUALIFICATION:',
      '➢ Pursued B. Tech. in Electrical Engineering in 2018 from Techno India,',
      'Saltlake, under MAKAUT.',
      '➢ Pursued Higher Secondary from Kendriya Vidyalaya in 2014.',
      '➢ Pursued Secondary from Kendriya Vidyalaya in 2012.',
      '',
      'PERSONAL DETAILS:',
      'Date of Birth: 12 September 1996',
      'DECLARATION:',
      'I hereby declare that the above is true.'),
    must: { name: 'Soutrick Das', exp: 1, edu: 3 },
  },
];

/* ------------------------------------------------------------- scoring */

const nonEmpty = (a) => (Array.isArray(a) ? a.filter(Boolean).length : 0);

function measure(d) {
  const e0 = (d.experience || [])[0] || {};
  return {
    name: d.basics.fullName,
    email: d.basics.email,
    exp: (d.experience || []).length,
    edu: (d.education || []).length,
    skills: nonEmpty(d.skills) > 0,
    skillGroups: nonEmpty(d.skills),
    company: e0.company || '',
    role: e0.role || '',
    start: e0.start || '',
    end: e0.end || '',
    bullets: (e0.bullets || '').split('\n').filter(Boolean).length,
    // A bullet that kept its marker was never recognised as one.
    cleanBullets: !/^[→✓▸•]/.test((e0.bullets || '').split('\n')[0] || ''),
    score: Boolean((d.education || []).some((x) => x.score)),
    summary: d.basics.summary || '',
  };
}

const compare = (got, want, key) => (key === 'summaryHas'
  ? String(got.summary).toLowerCase().includes(String(want).toLowerCase())
  : JSON.stringify(got[key]) === JSON.stringify(want));

let hardFails = 0;
const gaps = [];
let mustTotal = 0;
let mustOk = 0;
let wantTotal = 0;
let wantOk = 0;

console.log('=== importer scorecard ===' + NL);

for (const f of FIXTURES) {
  const got = measure(parseCV(f.text, blankData()).data);
  const bits = [];

  for (const [key, want] of Object.entries(f.must || {})) {
    mustTotal += 1;
    if (compare(got, want, key)) { mustOk += 1; } else {
      hardFails += 1;
      bits.push('MUST ' + key + ': want ' + JSON.stringify(want)
        + ', got ' + JSON.stringify(key === 'summaryHas' ? got.summary.slice(0, 60) : got[key]));
    }
  }
  for (const [key, want] of Object.entries(f.want || {})) {
    wantTotal += 1;
    if (compare(got, want, key)) { wantOk += 1; } else {
      gaps.push(f.name + ' -> ' + key + ': want ' + JSON.stringify(want)
        + ', got ' + JSON.stringify(key === 'summaryHas' ? got.summary.slice(0, 60) : got[key]));
    }
  }

  const mark = bits.length ? 'FAIL' : 'ok  ';
  console.log(mark + '  ' + f.name);
  bits.forEach((b) => console.log('        ' + b));
}

console.log(NL + '--- required behaviour: ' + mustOk + '/' + mustTotal + ' ---');
console.log('--- known gaps:         ' + wantOk + '/' + wantTotal + ' passing ---');
if (gaps.length) {
  console.log(NL + 'Still to fix:');
  gaps.forEach((g) => console.log('  - ' + g));
}

console.log(NL + (hardFails ? hardFails + ' FAILING' : 'all required behaviour holds'));
process.exit(hardFails ? 1 : 0);
