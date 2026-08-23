// Data model, form schema and sample content.
// Every repeatable editor section is generated from SECTIONS, so adding a
// field is a one-line change here rather than new markup plus new render code.

export const SECTION_IDS = [
  'summary', 'experience', 'education', 'projects', 'skills',
  'certifications', 'licences', 'publications', 'languages', 'achievements', 'custom',
];

// Sections most people never need. They stay out of the editor until a
// profession pack asks for them, or the user turns them on - otherwise every
// CV starts with two empty boxes about bar admissions.
export const OPTIONAL_SECTIONS = ['licences', 'publications'];

export function dateRange(it) {
  const end = it.current ? 'Present' : (it.end || '');
  if (it.start && end) return it.start + ' - ' + end;
  return it.start || end || '';
}

export const SECTIONS = {
  summary: {
    title: 'Professional summary',
    single: true, // one free-text block rather than a list of items
    hint: 'Two to four lines: what you do, how long you have done it, what you are good at.',
  },
  experience: {
    title: 'Work experience',
    addLabel: 'Add role',
    label: (it) => it.role || it.company || 'New role',
    sub: (it) => [it.company, dateRange(it)].filter(Boolean).join(' · '),
    blank: () => ({ role: '', company: '', location: '', start: '', end: '', current: false, bullets: '' }),
    fields: [
      { k: 'role', label: 'Job title', span: 6, placeholder: 'Senior Frontend Engineer' },
      { k: 'company', label: 'Company', span: 6, placeholder: 'Acme Pvt Ltd' },
      { k: 'location', label: 'Location', span: 4, placeholder: 'Bengaluru, India' },
      { k: 'start', label: 'Start', span: 4, placeholder: 'Mar 2021' },
      { k: 'end', label: 'End', span: 4, placeholder: 'Jul 2024', disabledBy: 'current' },
      { k: 'current', label: 'I currently work here', type: 'check', span: 12 },
      {
        k: 'bullets', label: 'What you did', type: 'lines', span: 12, rows: 5,
        placeholder: 'One achievement per line.\nCut checkout load time from 4.1s to 1.3s.\nLed a team of four engineers.',
      },
    ],
  },
  education: {
    title: 'Education',
    addLabel: 'Add education',
    label: (it) => it.degree || it.school || 'New qualification',
    sub: (it) => [it.school, dateRange(it)].filter(Boolean).join(' · '),
    blank: () => ({ degree: '', school: '', location: '', start: '', end: '', score: '', details: '' }),
    fields: [
      { k: 'degree', label: 'Degree / course', span: 6, placeholder: 'B.Tech, Computer Science' },
      { k: 'school', label: 'Institution', span: 6, placeholder: 'Delhi Technological University' },
      { k: 'location', label: 'Location', span: 4, placeholder: 'New Delhi' },
      { k: 'start', label: 'Start', span: 4, placeholder: '2016' },
      { k: 'end', label: 'End', span: 4, placeholder: '2020' },
      { k: 'score', label: 'Grade / score', span: 12, placeholder: 'CGPA 8.7 / 10' },
      {
        k: 'details', label: 'Highlights', type: 'lines', span: 12, rows: 3,
        placeholder: 'Coursework, thesis, honours - one per line.',
      },
    ],
  },
  projects: {
    title: 'Projects',
    addLabel: 'Add project',
    label: (it) => it.name || 'New project',
    sub: (it) => it.tech || it.link || '',
    blank: () => ({ name: '', tech: '', link: '', date: '', bullets: '' }),
    fields: [
      { k: 'name', label: 'Project name', span: 6, placeholder: 'Fleet tracker' },
      { k: 'date', label: 'When', span: 6, placeholder: '2024' },
      { k: 'tech', label: 'Built with', span: 6, placeholder: 'React, Node, PostgreSQL' },
      { k: 'link', label: 'Link', span: 6, placeholder: 'github.com/you/fleet-tracker' },
      { k: 'bullets', label: 'Description', type: 'lines', span: 12, rows: 4, placeholder: 'One line per point.' },
    ],
  },
  skills: {
    title: 'Skills',
    addLabel: 'Add skill group',
    label: (it) => it.group || 'New group',
    sub: (it) => it.items || '',
    blank: () => ({ group: '', items: '' }),
    fields: [
      { k: 'group', label: 'Group name', span: 12, placeholder: 'Languages' },
      {
        k: 'items', label: 'Skills (comma separated)', type: 'area', span: 12, rows: 2,
        placeholder: 'JavaScript, TypeScript, Python, SQL',
      },
    ],
  },
  certifications: {
    title: 'Certifications',
    addLabel: 'Add certification',
    label: (it) => it.name || 'New certification',
    sub: (it) => [it.issuer, it.year].filter(Boolean).join(' · '),
    blank: () => ({ name: '', issuer: '', year: '', link: '' }),
    fields: [
      { k: 'name', label: 'Certification', span: 12, placeholder: 'AWS Solutions Architect - Associate' },
      { k: 'issuer', label: 'Issued by', span: 6, placeholder: 'Amazon Web Services' },
      { k: 'year', label: 'Year', span: 6, placeholder: '2023' },
      { k: 'link', label: 'Credential link', span: 12, placeholder: 'Optional' },
    ],
  },
  languages: {
    title: 'Languages',
    addLabel: 'Add language',
    label: (it) => it.name || 'New language',
    sub: (it) => it.level || '',
    blank: () => ({ name: '', level: 'Fluent' }),
    fields: [
      { k: 'name', label: 'Language', span: 6, placeholder: 'Hindi' },
      {
        k: 'level', label: 'Level', type: 'select', span: 6,
        options: ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic'],
      },
    ],
  },
  achievements: {
    title: 'Achievements',
    addLabel: 'Add achievement',
    label: (it) => it.text || 'New achievement',
    blank: () => ({ text: '' }),
    fields: [
      {
        k: 'text', label: 'Achievement', type: 'area', span: 12, rows: 2,
        placeholder: 'Winner, Smart India Hackathon 2023 (out of 1,200 teams).',
      },
    ],
  },
  licences: {
    title: 'Licences & registrations',
    addLabel: 'Add licence',
    label: (it) => it.name || 'New licence',
    sub: (it) => [it.authority, it.number].filter(Boolean).join(' · '),
    blank: () => ({ name: '', authority: '', number: '', expiry: '' }),
    fields: [
      { k: 'name', label: 'Licence / registration', span: 12, placeholder: 'Registered Nurse (RN)' },
      { k: 'authority', label: 'Issuing body', span: 6, placeholder: 'Karnataka State Nursing Council' },
      { k: 'number', label: 'Registration number', span: 6, placeholder: 'KSNC/2019/45231' },
      { k: 'expiry', label: 'Valid until', span: 12, placeholder: 'Mar 2027' },
    ],
  },
  publications: {
    title: 'Publications',
    addLabel: 'Add publication',
    label: (it) => it.title || 'New publication',
    sub: (it) => [it.venue, it.year].filter(Boolean).join(' · '),
    blank: () => ({ title: '', venue: '', year: '', link: '' }),
    fields: [
      { k: 'title', label: 'Title and authors', type: 'area', span: 12, rows: 2,
        placeholder: 'Sharma, A., & Rao, K. (2024). Title of the paper.' },
      { k: 'venue', label: 'Journal / conference', span: 6, placeholder: 'ACM CHI 2024' },
      { k: 'year', label: 'Year', span: 6, placeholder: '2024' },
      { k: 'link', label: 'DOI or link', span: 12, placeholder: 'doi.org/10.1145/...' },
    ],
  },
  custom: {
    title: 'Custom sections',
    addLabel: 'Add custom section',
    label: (it) => it.heading || 'Untitled section',
    sub: (it) => (it.body || '').split('\n')[0],
    blank: () => ({ heading: '', body: '' }),
    fields: [
      { k: 'heading', label: 'Section heading', span: 12, placeholder: 'Volunteering' },
      { k: 'body', label: 'Content', type: 'lines', span: 12, rows: 4, placeholder: 'One line per point.' },
    ],
  },
};

export const BASICS_FIELDS = [
  { k: 'fullName', label: 'Full name', span: 12, placeholder: 'Ananya Sharma' },
  { k: 'headline', label: 'Job title / headline', span: 12, placeholder: 'Senior Frontend Engineer' },
  { k: 'email', label: 'Email', span: 6, placeholder: 'ananya@example.com' },
  { k: 'phone', label: 'Phone', span: 6, placeholder: '+91 98765 43210' },
  { k: 'location', label: 'Location', span: 6, placeholder: 'Bengaluru, India' },
  { k: 'website', label: 'Website / portfolio', span: 6, placeholder: 'ananya.dev' },
  { k: 'linkedin', label: 'LinkedIn', span: 6, placeholder: 'linkedin.com/in/ananya' },
  { k: 'github', label: 'GitHub / other', span: 6, placeholder: 'github.com/ananya' },
];

// A cover letter is a second document sharing the CV's identity block and
// look. Kept separate from SECTIONS because it is not a CV section.
export const COVER_FIELDS = [
  { k: 'role', label: 'Role you are applying for', span: 12, placeholder: 'Senior Frontend Engineer' },
  { k: 'company', label: 'Company', span: 6, placeholder: 'Zenpay Technologies' },
  { k: 'ref', label: 'Reference / job ID', span: 6, placeholder: 'Optional - e.g. REQ-4821' },
  { k: 'recipient', label: 'Addressed to', span: 6, placeholder: 'Ms Priya Raghavan' },
  { k: 'recipientTitle', label: 'Their title', span: 6, placeholder: 'Head of Engineering' },
  { k: 'companyAddress', label: 'Company address', type: 'area', span: 12, rows: 2,
    placeholder: 'Optional. One line per line of the address.' },
  { k: 'date', label: 'Date', span: 6, placeholder: 'Leave blank for today' },
  { k: 'signoff', label: 'Sign-off', type: 'select', span: 6,
    options: ['Yours sincerely', 'Yours faithfully', 'Kind regards', 'Best regards', 'Sincerely'] },
  { k: 'body', label: 'Letter', type: 'area', span: 12, rows: 12,
    placeholder: 'One paragraph per block. Leave a blank line between paragraphs.' },
];

export function blankCover() {
  return {
    role: '', company: '', ref: '', recipient: '', recipientTitle: '',
    companyAddress: '', date: '', signoff: 'Yours sincerely', body: '',
  };
}

// A scaffold, not a draft. Every bracket is something only the applicant knows;
// the checker flags any that are left in.
export function coverScaffold(basics, prof) {
  return [
    'I am writing to apply for the [role] position at [company], advertised on [where you saw it].',
    'I currently work as ' + (basics.headline || '[your current role]')
      + '. In that role I [the single most relevant thing you have done - include the number].',
    'I want to work at [company] specifically because [one concrete, checkable reason - a product '
      + 'you have used, a problem they have written about, someone you have spoken to]. '
      + 'The part of this role I am most equipped for is [name the requirement from the advert].',
    'I would welcome the chance to discuss the role. Thank you for your time.',
  ].join('\n\n');
}

export function blankData() {
  return {
    basics: {
      fullName: '', headline: '', email: '', phone: '', location: '',
      website: '', linkedin: '', github: '', photo: '', summary: '',
    },
    experience: [], education: [], projects: [], skills: [],
    certifications: [], licences: [], publications: [],
    languages: [], achievements: [], custom: [],
    cover: blankCover(),
    settings: {
      profession: 'general',
      region: 'india',
      template: 'classic',
      accent: '#2563eb',
      font: 'sans',
      scale: 100,
      density: 'normal',
      paper: 'a4',
      showPhoto: true,
      uppercaseHeadings: true,
      order: SECTION_IDS.slice(),
      labels: {},
      shown: {},
    },
  };
}

export function sampleData() {
  const d = blankData();
  d.basics = {
    fullName: 'Ananya Sharma',
    headline: 'Senior Frontend Engineer',
    email: 'ananya.sharma@example.com',
    phone: '+91 98765 43210',
    location: 'Bengaluru, India',
    website: 'ananya.dev',
    linkedin: 'linkedin.com/in/ananyasharma',
    github: 'github.com/ananyasharma',
    photo: '',
    summary:
      'Frontend engineer with six years building customer-facing products at scale. Focused on ' +
      'React design systems, web performance, and turning fuzzy product ideas into shipped features. ' +
      'Comfortable owning a surface end to end, from API contract to accessibility audit.',
  };
  d.experience = [
    {
      role: 'Senior Frontend Engineer', company: 'Zenpay', location: 'Bengaluru',
      start: 'Mar 2022', end: '', current: true,
      bullets: [
        'Rebuilt the checkout flow in React 18, cutting median load from 4.1s to 1.3s and lifting conversion 8.4%.',
        'Designed a shared component library now used by six squads and 40+ engineers.',
        'Mentored three junior engineers; two were promoted within a year.',
        'Introduced visual regression tests that caught 30+ UI defects before release.',
      ].join('\n'),
    },
    {
      role: 'Frontend Engineer', company: 'Craftly Labs', location: 'Pune',
      start: 'Jul 2019', end: 'Feb 2022', current: false,
      bullets: [
        'Shipped the merchant dashboard used daily by 12,000 sellers.',
        'Moved the build from Webpack to Vite, taking CI from 11 minutes to 3.',
        'Built an offline-first layer for users on patchy tier-2 networks.',
      ].join('\n'),
    },
  ];
  d.education = [
    {
      degree: 'B.Tech, Computer Science', school: 'Delhi Technological University',
      location: 'New Delhi', start: '2015', end: '2019', score: 'CGPA 8.7 / 10',
      details: 'Final year project: real-time collaborative code editor (CRDT based).\nSecretary, Developers Society.',
    },
  ];
  d.projects = [
    {
      name: 'Ledgerly', tech: 'React, Node, PostgreSQL',
      link: 'github.com/ananyasharma/ledgerly', date: '2024',
      bullets: 'Open-source double-entry bookkeeping app for freelancers, 1.8k GitHub stars.\nHandles multi-currency invoicing and GST-ready exports.',
    },
  ];
  d.skills = [
    { group: 'Languages', items: 'JavaScript, TypeScript, Python, SQL, HTML, CSS' },
    { group: 'Frameworks', items: 'React, Next.js, Node.js, Express, Tailwind CSS' },
    { group: 'Tooling', items: 'Vite, Playwright, Jest, Docker, GitHub Actions, Figma' },
    { group: 'Practices', items: 'Accessibility (WCAG 2.2), Web performance, Design systems' },
  ];
  d.certifications = [
    { name: 'AWS Certified Solutions Architect - Associate', issuer: 'Amazon Web Services', year: '2023', link: '' },
    { name: 'Professional Scrum Master I', issuer: 'Scrum.org', year: '2021', link: '' },
  ];
  d.languages = [
    { name: 'English', level: 'Fluent' },
    { name: 'Hindi', level: 'Native' },
    { name: 'Kannada', level: 'Intermediate' },
  ];
  d.achievements = [
    { text: 'Winner, Smart India Hackathon 2023 - built a rural logistics tracker, chosen from 1,200 teams.' },
    { text: 'Speaker, React India 2024: "Design systems that survive their designers".' },
  ];
  return d;
}
