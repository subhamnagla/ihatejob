// Profession and region packs.
//
// A CV is not one artefact. An academic CV and a sales resume disagree on
// length, on which section leads, and on what counts as evidence. Regions
// disagree on whether a photo or a date of birth is acceptable at all -
// including them costs you the screen in the US and UK.
//
// Each pack is data only. The editor applies it; the checker reads it to
// decide what "standardised" means for this particular person.

import { SECTION_IDS, OPTIONAL_SECTIONS } from './schema.js';

export const REGIONS = {
  india: {
    name: 'India',
    pages: [1, 2],
    photo: 'allowed',
    personalDetails: 'allowed',
    dateFormat: 'Mon YYYY',
    note: 'Indian employers accept a photo, but most large firms now screen with the '
      + 'same ATS software used abroad. Keep the layout parseable even when you include one.',
  },
  us: {
    name: 'United States',
    pages: [1, 1],
    photo: 'forbidden',
    personalDetails: 'forbidden',
    dateFormat: 'Mon YYYY',
    note: 'No photo, date of birth, marital status, gender or nationality - US anti-discrimination '
      + 'practice means recruiters often discard CVs that include them. One page unless you are senior.',
  },
  uk: {
    name: 'United Kingdom',
    pages: [1, 2],
    photo: 'forbidden',
    personalDetails: 'forbidden',
    dateFormat: 'Mon YYYY',
    note: 'No photo or personal details. Two pages is the norm. British spelling is expected.',
  },
  canada: {
    name: 'Canada',
    pages: [1, 2],
    photo: 'forbidden',
    personalDetails: 'forbidden',
    dateFormat: 'Mon YYYY',
    note: 'Same rules as the US on photos and personal details. Two pages is accepted.',
  },
  australia: {
    name: 'Australia / NZ',
    pages: [2, 3],
    photo: 'discouraged',
    personalDetails: 'forbidden',
    dateFormat: 'Mon YYYY',
    note: 'Longer CVs are normal - two to three pages. No photo, no personal details.',
  },
  germany: {
    name: 'Germany / Austria',
    pages: [1, 2],
    photo: 'expected',
    personalDetails: 'allowed',
    dateFormat: 'MM/YYYY',
    note: 'A photo is conventional and its absence is noticed. Dates are usually written MM/YYYY.',
  },
  gulf: {
    name: 'UAE / Gulf',
    pages: [2, 3],
    photo: 'expected',
    personalDetails: 'expected',
    dateFormat: 'Mon YYYY',
    note: 'A photo, nationality and visa status are commonly expected. Longer CVs are normal.',
  },
  singapore: {
    name: 'Singapore',
    pages: [1, 2],
    photo: 'allowed',
    personalDetails: 'allowed',
    dateFormat: 'Mon YYYY',
    note: 'A photo is accepted. Many employers still ask for current and expected salary separately - '
      + 'keep that out of the CV itself.',
  },
  ireland: {
    name: 'Ireland',
    pages: [1, 2],
    photo: 'forbidden',
    personalDetails: 'forbidden',
    dateFormat: 'Mon YYYY',
    note: 'No photo or personal details. Two pages is standard, and referees are often listed or '
      + 'noted as available on request.',
  },
  netherlands: {
    name: 'Netherlands',
    pages: [1, 2],
    photo: 'allowed',
    personalDetails: 'allowed',
    dateFormat: 'MM/YYYY',
    note: 'A photo is optional and common. Dutch CVs are direct and factual; date of birth is still '
      + 'sometimes included, though younger employers increasingly leave it out.',
  },
  france: {
    name: 'France',
    pages: [1, 2],
    photo: 'allowed',
    personalDetails: 'allowed',
    dateFormat: 'MM/YYYY',
    note: 'One page is expected below about ten years of experience. A photo is common but optional, '
      + 'and a short "centres d\'interet" line is conventional.',
  },
  nordics: {
    name: 'Nordics',
    pages: [1, 2],
    photo: 'allowed',
    personalDetails: 'allowed',
    dateFormat: 'Mon YYYY',
    note: 'Sweden, Norway, Denmark and Finland. Photos are common and informal, hierarchy is played '
      + 'down, and a plain factual tone is preferred to salesmanship.',
  },
  japan: {
    name: 'Japan',
    pages: [2, 3],
    photo: 'expected',
    personalDetails: 'expected',
    dateFormat: 'YYYY/MM',
    note: 'Japanese employers usually want a rirekisho, a prescribed form with a photo, date of birth '
      + 'and a fixed field layout, often alongside a shokumu keirekisho career history. This builder '
      + 'produces a Western-style CV - suitable for foreign firms, not for a standard rirekisho request.',
  },
  china: {
    name: 'China',
    pages: [1, 2],
    photo: 'expected',
    personalDetails: 'expected',
    dateFormat: 'YYYY/MM',
    note: 'A photo, date of birth and nationality are conventional. Many employers also expect a '
      + 'Chinese-language version alongside the English one.',
  },
  'south-korea': {
    name: 'South Korea',
    pages: [1, 2],
    photo: 'expected',
    personalDetails: 'expected',
    dateFormat: 'YYYY.MM',
    note: 'A photo is standard. Large employers often require their own application form, so treat '
      + 'this CV as the supporting document rather than the application itself.',
  },
  'south-africa': {
    name: 'South Africa',
    pages: [2, 3],
    photo: 'allowed',
    personalDetails: 'allowed',
    dateFormat: 'Mon YYYY',
    note: 'Longer CVs are normal. Employment equity status and ID number are commonly requested, '
      + 'though usually on the application form rather than the CV.',
  },
  nigeria: {
    name: 'Nigeria',
    pages: [2, 3],
    photo: 'allowed',
    personalDetails: 'allowed',
    dateFormat: 'Mon YYYY',
    note: 'Two to three pages is normal. State of origin and NYSC completion are commonly listed, '
      + 'and referees are usually named in full.',
  },
  malaysia: {
    name: 'Malaysia',
    pages: [1, 2],
    photo: 'allowed',
    personalDetails: 'allowed',
    dateFormat: 'Mon YYYY',
    note: 'A photo is accepted. Expected salary is often asked for separately - keep it off the CV.',
  },
  philippines: {
    name: 'Philippines',
    pages: [1, 3],
    photo: 'expected',
    personalDetails: 'expected',
    dateFormat: 'Mon YYYY',
    note: 'A photo and personal details are conventional, and character references are commonly '
      + 'named. Government roles may require the prescribed PDS form instead.',
  },
  brazil: {
    name: 'Brazil / LatAm',
    pages: [1, 2],
    photo: 'allowed',
    personalDetails: 'allowed',
    dateFormat: 'MM/YYYY',
    note: 'A photo is common. Language levels are read closely, so state them precisely rather than '
      + 'claiming fluency loosely.',
  },
};

// Shared building blocks so the packs below stay readable.
const CORE = ['summary', 'experience', 'education', 'skills'];
const TAIL = ['certifications', 'achievements', 'languages', 'custom'];

export const PROFESSIONS = {
  'software-engineering': {
    name: 'Software / IT',
    group: 'Technology',
    template: 'modern',
    pages: [1, 2],
    order: ['summary', 'skills', 'experience', 'projects', 'education', ...TAIL.filter((s) => s !== 'custom'), 'custom'],
    require: ['skills', 'experience'],
    recommend: ['projects'],
    labels: { skills: 'Technical Skills' },
    guidance: {
      summary: 'Name the stack and the kind of systems you build. Skip adjectives.',
      experience: 'Lead with what changed: latency, error rate, build time, cost, users served.',
      projects: 'Recruiters do open these links. Only list what you would be happy to have read.',
    },
    verbs: ['Built', 'Shipped', 'Migrated', 'Reduced', 'Automated', 'Designed', 'Scaled', 'Refactored', 'Instrumented', 'Debugged'],
    metrics: ['latency', 'p95', 'uptime', 'throughput', 'build time', 'error rate', 'test coverage', 'requests per second', 'users'],
    wants: { link: 'A GitHub or portfolio link is close to mandatory for engineering roles.' },
  },

  'data-analytics': {
    name: 'Data / Analytics / ML',
    group: 'Technology',
    template: 'modern',
    pages: [1, 2],
    order: ['summary', 'skills', 'experience', 'projects', 'education', 'publications', ...TAIL],
    require: ['skills', 'experience'],
    recommend: ['projects'],
    labels: { skills: 'Technical Skills' },
    guidance: {
      experience: 'State the decision your analysis changed, not the tool you opened.',
      projects: 'Include the dataset size and the measured result - accuracy alone means little.',
    },
    verbs: ['Modelled', 'Forecast', 'Segmented', 'Automated', 'Reduced', 'Identified', 'Validated', 'Deployed'],
    metrics: ['accuracy', 'AUC', 'RMSE', 'lift', 'revenue', 'churn', 'rows processed', 'runtime'],
  },

  'product-management': {
    name: 'Product Management',
    group: 'Technology',
    template: 'minimal',
    pages: [1, 2],
    order: ['summary', 'experience', 'skills', 'projects', 'education', ...TAIL],
    require: ['experience', 'summary'],
    guidance: {
      experience: 'Own the outcome, not the ceremony. Adoption, retention, revenue - not "ran standups".',
    },
    verbs: ['Launched', 'Grew', 'Prioritised', 'Defined', 'Killed', 'Negotiated', 'Validated'],
    metrics: ['adoption', 'retention', 'activation', 'revenue', 'NPS', 'churn', 'time to value'],
  },

  design: {
    name: 'Design / UX / Creative',
    group: 'Creative & Media',
    template: 'creative',
    pages: [1, 2],
    order: ['summary', 'experience', 'projects', 'skills', 'education', ...TAIL],
    require: ['experience', 'projects'],
    labels: { projects: 'Selected Work' },
    guidance: {
      projects: 'Your portfolio does the persuading. The CV only needs to get it opened.',
      experience: 'Say what the design changed - task success, drop-off, support tickets.',
    },
    verbs: ['Designed', 'Prototyped', 'Researched', 'Tested', 'Simplified', 'Rebuilt', 'Facilitated'],
    metrics: ['task success', 'drop-off', 'conversion', 'support tickets', 'time on task'],
    wants: { link: 'A portfolio link is mandatory. A design CV without one is usually discarded.' },
  },

  marketing: {
    name: 'Marketing / Content',
    group: 'Business',
    template: 'minimal',
    pages: [1, 2],
    order: ['summary', 'experience', 'skills', 'projects', 'education', ...TAIL],
    require: ['experience'],
    guidance: {
      experience: 'Marketing is judged on numbers. Spend, CAC, traffic, pipeline, conversion.',
    },
    verbs: ['Grew', 'Launched', 'Ranked', 'Reduced', 'Tested', 'Built', 'Managed'],
    metrics: ['CAC', 'ROAS', 'traffic', 'conversion', 'pipeline', 'open rate', 'spend managed'],
  },

  'sales-bd': {
    name: 'Sales / Business Development',
    group: 'Business',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'experience', 'achievements', 'skills', 'education', 'certifications', 'languages', 'custom'],
    require: ['experience', 'achievements'],
    guidance: {
      experience: 'Quota attainment, territory, deal size, ranking. A sales CV without percentages is unreadable to a sales manager.',
      achievements: 'Club memberships, rankings and streaks belong here.',
    },
    verbs: ['Closed', 'Exceeded', 'Grew', 'Opened', 'Negotiated', 'Retained', 'Ranked'],
    metrics: ['quota attainment', 'revenue', 'deal size', 'win rate', 'pipeline', 'ranking'],
  },

  'finance-accounting': {
    name: 'Finance / Accounting',
    group: 'Business',
    template: 'executive',
    pages: [1, 2],
    order: ['summary', 'certifications', 'experience', 'education', 'skills', 'achievements', 'languages', 'licences', 'custom'],
    require: ['experience', 'education'],
    recommend: ['certifications'],
    labels: { certifications: 'Qualifications' },
    guidance: {
      certifications: 'CA, CFA, CPA, ACCA and their level or year belong at the top - they are the first filter.',
      experience: 'Quantify what you controlled: AUM, budget, transaction volume, audit scope.',
    },
    verbs: ['Audited', 'Reconciled', 'Forecast', 'Reduced', 'Managed', 'Advised', 'Closed'],
    metrics: ['AUM', 'budget', 'revenue', 'cost saving', 'transaction volume', 'audit scope'],
  },

  consulting: {
    name: 'Consulting / Strategy',
    group: 'Business',
    template: 'executive',
    pages: [1, 1],
    order: ['summary', 'experience', 'education', 'skills', 'achievements', 'languages', 'certifications', 'custom'],
    require: ['experience', 'education'],
    guidance: {
      experience: 'One line per engagement: client type, problem, result. Firms read for structure.',
      education: 'Consulting screens hard on academics. Keep scores and percentile in.',
    },
    verbs: ['Advised', 'Diagnosed', 'Restructured', 'Modelled', 'Recommended', 'Delivered'],
    metrics: ['cost saving', 'revenue uplift', 'engagement length', 'team size', 'client size'],
  },

  'healthcare-clinical': {
    name: 'Healthcare / Nursing / Clinical',
    group: 'Health & Life sciences',
    template: 'classic',
    pages: [2, 3],
    order: ['summary', 'licences', 'experience', 'education', 'certifications', 'skills', 'publications', 'achievements', 'languages', 'custom'],
    require: ['licences', 'experience', 'education'],
    labels: { experience: 'Clinical Experience', skills: 'Clinical Skills' },
    guidance: {
      licences: 'Registration body and number, and the expiry date. This is the first thing verified.',
      experience: 'Setting, unit, patient load and acuity. "Ward" alone tells a recruiter nothing.',
      certifications: 'BLS, ACLS, PALS and similar, with expiry dates.',
    },
    verbs: ['Assessed', 'Administered', 'Monitored', 'Coordinated', 'Educated', 'Documented', 'Triaged'],
    metrics: ['patient load', 'bed count', 'acuity', 'shift length', 'readmission rate'],
    wants: { licence: 'A clinical CV without a registration number will not clear credentialing.' },
  },

  law: {
    name: 'Law / Legal',
    group: 'Legal & Public',
    template: 'executive',
    pages: [1, 2],
    order: ['summary', 'licences', 'experience', 'education', 'publications', 'skills', 'achievements', 'languages', 'certifications', 'custom'],
    require: ['licences', 'experience', 'education'],
    labels: { licences: 'Bar Admission', experience: 'Legal Experience' },
    guidance: {
      licences: 'Bar council, enrolment number and year of admission.',
      experience: 'Practice area, matter type and your actual role in it.',
    },
    verbs: ['Drafted', 'Advised', 'Represented', 'Negotiated', 'Researched', 'Filed'],
    metrics: ['matter value', 'caseload', 'success rate', 'jurisdiction count'],
  },

  'teaching-education': {
    name: 'Teaching / Education',
    group: 'Education & Academic',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'experience', 'education', 'licences', 'certifications', 'skills', 'achievements', 'publications', 'languages', 'custom'],
    require: ['experience', 'education'],
    labels: { experience: 'Teaching Experience', licences: 'Teaching Certification' },
    guidance: {
      experience: 'Subjects, grade levels, board or curriculum, class size, and measured student outcomes.',
    },
    verbs: ['Taught', 'Designed', 'Assessed', 'Mentored', 'Raised', 'Adapted', 'Led'],
    metrics: ['class size', 'pass rate', 'average score', 'grade levels', 'student count'],
  },

  'core-engineering': {
    name: 'Mechanical / Civil / Electrical',
    group: 'Engineering',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'skills', 'experience', 'projects', 'education', 'licences', ...TAIL],
    require: ['experience', 'education', 'skills'],
    labels: { skills: 'Technical Skills', projects: 'Key Projects' },
    guidance: {
      experience: 'Project value, tolerances, standards followed, safety record, team size.',
      licences: 'Chartered status or professional engineer registration, where you hold it.',
    },
    verbs: ['Designed', 'Commissioned', 'Inspected', 'Optimised', 'Supervised', 'Tested', 'Reduced'],
    metrics: ['project value', 'tonnage', 'downtime', 'yield', 'defect rate', 'team size'],
  },

  'operations-supply': {
    name: 'Operations / Supply Chain',
    group: 'Business',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'experience', 'skills', 'education', 'certifications', 'achievements', 'languages', 'projects', 'custom'],
    require: ['experience'],
    guidance: {
      experience: 'Throughput, cost per unit, on-time delivery, inventory turns, headcount managed.',
    },
    verbs: ['Reduced', 'Streamlined', 'Negotiated', 'Forecast', 'Managed', 'Standardised'],
    metrics: ['on-time delivery', 'cost per unit', 'inventory turns', 'throughput', 'headcount'],
  },

  'human-resources': {
    name: 'Human Resources',
    group: 'Business',
    template: 'minimal',
    pages: [1, 2],
    order: [...CORE, 'certifications', 'achievements', 'languages', 'projects', 'custom'],
    require: ['experience'],
    guidance: {
      experience: 'Headcount supported, time to hire, attrition, offer acceptance rate.',
    },
    verbs: ['Hired', 'Reduced', 'Designed', 'Negotiated', 'Advised', 'Rolled out'],
    metrics: ['time to hire', 'attrition', 'headcount', 'offer acceptance', 'engagement score'],
  },

  'academic-research': {
    name: 'Academic / Research',
    group: 'Education & Academic',
    template: 'academic',
    pages: [2, 8],
    order: ['summary', 'education', 'experience', 'publications', 'achievements', 'projects', 'skills', 'licences', 'certifications', 'languages', 'custom'],
    require: ['education', 'publications'],
    labels: { summary: 'Research Interests', experience: 'Academic Appointments', achievements: 'Grants, Awards & Funding' },
    guidance: {
      summary: 'Two or three lines on your research area, not a marketing pitch.',
      publications: 'Full citations in a consistent style. This is the section that is actually read.',
      achievements: 'Grants with amounts and funding body, awards with year.',
    },
    verbs: ['Investigated', 'Published', 'Supervised', 'Secured', 'Presented', 'Peer-reviewed'],
    metrics: ['citations', 'h-index', 'grant amount', 'cohort size', 'sample size'],
    longForm: true,
    wants: { publications: 'An academic CV is judged on its publication record. Do not omit it.' },
  },

  'student-fresher': {
    name: 'Student / Fresher',
    group: 'Early career',
    template: 'minimal',
    pages: [1, 1],
    order: ['summary', 'education', 'projects', 'skills', 'experience', 'certifications', 'achievements', 'languages', 'custom'],
    require: ['education', 'projects'],
    labels: { experience: 'Internships & Part-time Work', summary: 'Objective' },
    guidance: {
      education: 'Education leads while you have little work history. Include scores.',
      projects: 'Projects are your evidence. Coursework counts if you can describe what you built.',
      summary: 'One or two lines. Say the role you want and what you can already do.',
    },
    verbs: ['Built', 'Led', 'Won', 'Organised', 'Analysed', 'Volunteered', 'Presented'],
    metrics: ['team size', 'participants', 'rank', 'score', 'duration'],
  },

  'government-psu': {
    name: 'Government / PSU (India)',
    group: 'Legal & Public',
    template: 'federal',
    pages: [2, 4],
    order: ['summary', 'education', 'experience', 'licences', 'certifications', 'skills', 'achievements', 'languages', 'projects', 'custom'],
    require: ['education', 'experience'],
    labels: { summary: 'Bio-data Summary' },
    guidance: {
      summary: 'Government applications are checked against the advertisement clause by clause. '
        + 'Mirror the wording of the notification where it applies to you.',
      education: 'Board or university, year, percentage and division for every qualification.',
    },
    verbs: ['Administered', 'Implemented', 'Supervised', 'Coordinated', 'Verified'],
    metrics: ['scheme size', 'beneficiaries', 'budget', 'districts covered', 'staff supervised'],
    personalDetailsExpected: true,
    longForm: true,
  },

  cybersecurity: {
    name: 'Cybersecurity',
    group: 'Technology',
    template: 'modern',
    pages: [1, 2],
    order: ['summary', 'skills', 'certifications', 'experience', 'projects', 'education', 'achievements', 'languages', 'licences', 'publications', 'custom'],
    require: ['skills', 'experience', 'certifications'],
    labels: { skills: 'Security Skills', certifications: 'Security Certifications' },
    guidance: {
      certifications: 'OSCP, CISSP, CEH, Security+ and their dates. These are screened on before anything else.',
      experience: 'Scope matters: estate size, incidents handled, mean time to detect, findings closed.',
      projects: 'CTF placings, CVEs credited to you, and public write-ups all count as evidence.',
    },
    verbs: ['Hardened', 'Detected', 'Contained', 'Audited', 'Patched', 'Simulated', 'Reduced'],
    metrics: ['mean time to detect', 'incidents handled', 'endpoints', 'findings closed', 'CVSS', 'phishing click rate'],
  },

  'it-support': {
    name: 'IT Support / SysAdmin',
    group: 'Technology',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'skills', 'certifications', 'experience', 'education', 'achievements', 'languages', 'projects', 'custom'],
    require: ['skills', 'experience'],
    recommend: ['certifications'],
    labels: { skills: 'Technical Skills' },
    guidance: {
      experience: 'Ticket volume, resolution time, user base supported, uptime. Support is measured work.',
      certifications: 'CompTIA, Microsoft, Cisco, ITIL - list the level and year.',
    },
    verbs: ['Resolved', 'Configured', 'Migrated', 'Automated', 'Documented', 'Restored'],
    metrics: ['tickets per week', 'first-call resolution', 'uptime', 'users supported', 'SLA met'],
  },

  architecture: {
    name: 'Architecture',
    group: 'Engineering',
    template: 'minimal',
    pages: [1, 2],
    order: ['summary', 'experience', 'projects', 'education', 'licences', 'skills', 'achievements', 'certifications', 'languages', 'custom'],
    require: ['experience', 'education', 'projects'],
    recommend: ['licences'],
    labels: { projects: 'Selected Projects', licences: 'Registration' },
    guidance: {
      projects: 'Built area, budget, typology and your actual role - concept, DD, or site.',
      licences: 'Council of Architecture or equivalent registration number.',
    },
    verbs: ['Designed', 'Detailed', 'Coordinated', 'Delivered', 'Surveyed', 'Specified'],
    metrics: ['built area', 'project value', 'unit count', 'programme length'],
    wants: { link: 'A portfolio link is expected. Architecture is judged visually.' },
  },

  agriculture: {
    name: 'Agriculture / Agri-business',
    group: 'Engineering',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'experience', 'education', 'skills', 'certifications', 'projects', 'achievements', 'languages', 'custom'],
    require: ['experience', 'education'],
    guidance: {
      experience: 'Acreage, yield change, crop or livestock type, and the scheme or supply chain you worked in.',
    },
    verbs: ['Raised', 'Trialled', 'Advised', 'Procured', 'Surveyed', 'Managed'],
    metrics: ['acreage', 'yield per hectare', 'farmers reached', 'input cost', 'procurement volume'],
  },

  pharmacy: {
    name: 'Pharmacy / Pharmaceutical',
    group: 'Health & Life sciences',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'licences', 'experience', 'education', 'certifications', 'skills', 'publications', 'achievements', 'languages', 'custom'],
    require: ['licences', 'experience', 'education'],
    labels: { licences: 'Registration' },
    guidance: {
      licences: 'State Pharmacy Council registration number and validity.',
      experience: 'Setting and scope: dispensing volume, formulary work, GMP area, audit outcomes.',
    },
    verbs: ['Dispensed', 'Counselled', 'Validated', 'Audited', 'Formulated', 'Reconciled'],
    metrics: ['prescriptions per day', 'batch size', 'deviation rate', 'audit findings'],
    wants: { licence: 'Pharmacy roles verify registration before interview.' },
  },

  dentistry: {
    name: 'Dentistry',
    group: 'Health & Life sciences',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'licences', 'experience', 'education', 'certifications', 'skills', 'publications', 'achievements', 'languages', 'custom'],
    require: ['licences', 'experience', 'education'],
    labels: { experience: 'Clinical Experience', licences: 'Dental Registration' },
    guidance: {
      licences: 'Dental Council registration number and state.',
      experience: 'Procedures performed and volume, chair time, and the case mix you are comfortable with.',
    },
    verbs: ['Performed', 'Diagnosed', 'Restored', 'Extracted', 'Managed', 'Referred'],
    metrics: ['cases per month', 'procedure count', 'chair time', 'recall rate'],
  },

  physiotherapy: {
    name: 'Physiotherapy / Rehab',
    group: 'Health & Life sciences',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'licences', 'experience', 'education', 'certifications', 'skills', 'achievements', 'languages', 'publications', 'custom'],
    require: ['licences', 'experience', 'education'],
    labels: { experience: 'Clinical Experience', skills: 'Clinical Skills' },
    guidance: {
      experience: 'Caseload, setting, specialism (musculoskeletal, neuro, sports) and outcome measures used.',
    },
    verbs: ['Assessed', 'Rehabilitated', 'Mobilised', 'Prescribed', 'Educated', 'Discharged'],
    metrics: ['caseload', 'sessions per week', 'discharge rate', 'outcome scores'],
  },

  psychology: {
    name: 'Psychology / Counselling',
    group: 'Health & Life sciences',
    template: 'minimal',
    pages: [1, 2],
    order: ['summary', 'licences', 'experience', 'education', 'certifications', 'skills', 'publications', 'achievements', 'languages', 'custom'],
    require: ['experience', 'education'],
    recommend: ['licences'],
    labels: { experience: 'Clinical & Practice Experience' },
    guidance: {
      licences: 'RCI registration or equivalent, and supervised hours completed.',
      experience: 'Client group, modality (CBT, DBT, psychodynamic), caseload and supervision arrangements.',
    },
    verbs: ['Assessed', 'Counselled', 'Facilitated', 'Supervised', 'Screened', 'Referred'],
    metrics: ['caseload', 'supervised hours', 'sessions delivered', 'client group size'],
  },

  'lab-technology': {
    name: 'Medical Lab / Diagnostics',
    group: 'Health & Life sciences',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'licences', 'skills', 'experience', 'education', 'certifications', 'achievements', 'languages', 'custom'],
    require: ['experience', 'education', 'skills'],
    labels: { skills: 'Techniques & Instrumentation' },
    guidance: {
      experience: 'Sample throughput, assays run, accreditation standard (NABL, CAP) and QC record.',
      skills: 'Name the instruments and assays. This section is keyword-matched hard.',
    },
    verbs: ['Processed', 'Calibrated', 'Validated', 'Reported', 'Maintained', 'Audited'],
    metrics: ['samples per day', 'turnaround time', 'QC pass rate', 'assay count'],
  },

  veterinary: {
    name: 'Veterinary',
    group: 'Health & Life sciences',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'licences', 'experience', 'education', 'skills', 'certifications', 'achievements', 'languages', 'custom'],
    require: ['licences', 'experience', 'education'],
    labels: { experience: 'Clinical Experience', licences: 'Registration' },
    guidance: {
      licences: 'Veterinary Council registration number and state.',
      experience: 'Species handled, caseload, practice type and surgical exposure.',
    },
    verbs: ['Diagnosed', 'Treated', 'Operated', 'Vaccinated', 'Advised', 'Managed'],
    metrics: ['caseload', 'surgeries performed', 'species', 'herd size'],
  },

  journalism: {
    name: 'Journalism / Media',
    group: 'Creative & Media',
    template: 'minimal',
    pages: [1, 2],
    order: ['summary', 'experience', 'publications', 'skills', 'education', 'achievements', 'languages', 'certifications', 'custom'],
    require: ['experience'],
    recommend: ['publications'],
    labels: { publications: 'Selected Bylines' },
    guidance: {
      publications: 'Link the pieces. Editors read the work, not the description of the work.',
      experience: 'Beat, output rate, and what the reporting produced - a correction, a policy change, a scoop.',
    },
    verbs: ['Reported', 'Investigated', 'Broke', 'Edited', 'Filed', 'Produced'],
    metrics: ['stories per week', 'readership', 'time on page', 'exclusives'],
    wants: { link: 'A portfolio or clips link is expected for editorial roles.' },
  },

  'film-animation': {
    name: 'Film / Animation / VFX',
    group: 'Creative & Media',
    template: 'creative',
    pages: [1, 2],
    order: ['summary', 'experience', 'projects', 'skills', 'education', 'achievements', 'certifications', 'languages', 'custom'],
    require: ['experience', 'projects', 'skills'],
    labels: { projects: 'Credits', skills: 'Software & Techniques' },
    guidance: {
      projects: 'Title, year, studio and your exact credit. Ambiguity about your role reads badly here.',
      skills: 'Name the packages and versions - Maya, Houdini, Nuke, Unreal.',
    },
    verbs: ['Animated', 'Composited', 'Modelled', 'Rigged', 'Lit', 'Edited'],
    metrics: ['shot count', 'runtime delivered', 'crew size', 'turnaround'],
    wants: { link: 'A showreel link is mandatory. No reel, no callback.' },
  },

  'content-writing': {
    name: 'Content / Copywriting',
    group: 'Creative & Media',
    template: 'minimal',
    pages: [1, 2],
    order: ['summary', 'experience', 'publications', 'skills', 'projects', 'education', 'achievements', 'languages', 'certifications', 'custom'],
    require: ['experience'],
    recommend: ['publications'],
    labels: { publications: 'Selected Work' },
    guidance: {
      experience: 'Output volume, traffic or conversion the writing produced, and the formats you handle.',
    },
    verbs: ['Wrote', 'Ranked', 'Grew', 'Edited', 'Restructured', 'Launched'],
    metrics: ['words per month', 'organic traffic', 'conversion', 'keyword rankings', 'open rate'],
    wants: { link: 'Link your portfolio. Writing roles are hired on samples.' },
  },

  hospitality: {
    name: 'Hotels / Hospitality',
    group: 'Service & Hospitality',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'experience', 'skills', 'education', 'certifications', 'languages', 'achievements', 'projects', 'custom'],
    require: ['experience'],
    recommend: ['languages'],
    guidance: {
      experience: 'Property size, covers or room count, occupancy, guest scores and team size.',
      languages: 'Languages matter more here than in most fields. List them honestly with levels.',
    },
    verbs: ['Managed', 'Raised', 'Trained', 'Coordinated', 'Reduced', 'Hosted'],
    metrics: ['room count', 'covers per service', 'occupancy', 'guest score', 'RevPAR', 'team size'],
  },

  culinary: {
    name: 'Culinary / Kitchen',
    group: 'Service & Hospitality',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'experience', 'skills', 'certifications', 'education', 'achievements', 'languages', 'custom'],
    require: ['experience'],
    labels: { skills: 'Cuisines & Techniques' },
    guidance: {
      experience: 'Covers per service, brigade size, cuisine, food cost percentage and any awards the kitchen held.',
      certifications: 'Food safety and HACCP certification with dates.',
    },
    verbs: ['Ran', 'Designed', 'Costed', 'Trained', 'Reduced', 'Opened'],
    metrics: ['covers per service', 'food cost %', 'brigade size', 'menu count', 'wastage'],
  },

  aviation: {
    name: 'Aviation / Cabin Crew',
    group: 'Service & Hospitality',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'licences', 'experience', 'certifications', 'education', 'skills', 'languages', 'achievements', 'custom'],
    require: ['licences', 'experience'],
    labels: { licences: 'Licences & Ratings' },
    guidance: {
      licences: 'Licence type and number, ratings, medical class and expiry. All are verified.',
      experience: 'Hours by type for flight crew; fleet, sectors and routes for cabin crew.',
    },
    verbs: ['Operated', 'Handled', 'Briefed', 'Managed', 'Assisted', 'Completed'],
    metrics: ['flight hours', 'sectors', 'aircraft type', 'passengers served'],
    wants: { licence: 'Aviation roles cannot proceed without licence and medical details.' },
  },

  'retail-customer': {
    name: 'Retail / Customer Service',
    group: 'Service & Hospitality',
    template: 'classic',
    pages: [1, 1],
    order: ['summary', 'experience', 'skills', 'education', 'certifications', 'achievements', 'languages', 'custom'],
    require: ['experience'],
    guidance: {
      experience: 'Sales against target, footfall, basket size, CSAT and how many people you were responsible for.',
    },
    verbs: ['Sold', 'Exceeded', 'Resolved', 'Trained', 'Merchandised', 'Reduced'],
    metrics: ['sales vs target', 'CSAT', 'basket size', 'shrinkage', 'calls per day'],
  },

  'skilled-trades': {
    name: 'Skilled Trades / Technician',
    group: 'Service & Hospitality',
    template: 'ats',
    pages: [1, 2],
    order: ['summary', 'skills', 'licences', 'experience', 'certifications', 'education', 'achievements', 'languages', 'custom'],
    require: ['experience', 'skills'],
    recommend: ['certifications'],
    labels: { skills: 'Trade Skills', licences: 'Tickets & Licences' },
    guidance: {
      licences: 'Trade licence, safety tickets and driving categories, with expiry dates.',
      experience: 'Equipment worked on, standards followed, safety record and job volume.',
    },
    verbs: ['Installed', 'Repaired', 'Serviced', 'Commissioned', 'Inspected', 'Fabricated'],
    metrics: ['jobs per week', 'downtime', 'first-time fix rate', 'safety record'],
  },

  'banking-bfsi': {
    name: 'Banking / BFSI',
    group: 'Business',
    template: 'executive',
    pages: [1, 2],
    order: ['summary', 'experience', 'certifications', 'education', 'skills', 'achievements', 'languages', 'licences', 'custom'],
    require: ['experience', 'education'],
    guidance: {
      experience: 'Portfolio size, disbursement volume, NPA percentage, branch or region, and targets met.',
      certifications: 'NISM, IRDA, JAIIB, CAIIB and similar, with year.',
    },
    verbs: ['Disbursed', 'Grew', 'Recovered', 'Underwrote', 'Cross-sold', 'Reduced'],
    metrics: ['portfolio size', 'disbursement', 'NPA %', 'CASA growth', 'target achievement'],
  },

  'insurance-actuarial': {
    name: 'Insurance / Actuarial',
    group: 'Business',
    template: 'executive',
    pages: [1, 2],
    order: ['summary', 'certifications', 'experience', 'education', 'skills', 'achievements', 'languages', 'custom'],
    require: ['experience', 'education'],
    recommend: ['certifications'],
    labels: { certifications: 'Actuarial Exams & Qualifications' },
    guidance: {
      certifications: 'List exams passed with sitting dates. Progress through the exams is the main signal.',
      experience: 'Reserving, pricing or capital work, book size, and the regimes you have worked under.',
    },
    verbs: ['Priced', 'Reserved', 'Modelled', 'Valued', 'Reviewed', 'Reported'],
    metrics: ['book size', 'loss ratio', 'reserve movement', 'policies', 'combined ratio'],
  },

  'real-estate': {
    name: 'Real Estate / Property',
    group: 'Business',
    template: 'classic',
    pages: [1, 2],
    order: ['summary', 'experience', 'achievements', 'skills', 'licences', 'education', 'certifications', 'languages', 'custom'],
    require: ['experience'],
    guidance: {
      experience: 'Transaction value, units closed, portfolio managed, occupancy and yield.',
      licences: 'RERA registration or equivalent agent licence number.',
    },
    verbs: ['Closed', 'Leased', 'Sourced', 'Negotiated', 'Managed', 'Valued'],
    metrics: ['transaction value', 'units closed', 'occupancy', 'yield', 'portfolio size'],
  },

  'social-work-ngo': {
    name: 'Social Work / NGO',
    group: 'Legal & Public',
    template: 'minimal',
    pages: [1, 2],
    order: ['summary', 'experience', 'education', 'skills', 'achievements', 'projects', 'certifications', 'languages', 'publications', 'custom'],
    require: ['experience', 'education'],
    labels: { achievements: 'Grants & Recognition' },
    guidance: {
      experience: 'Beneficiaries reached, geography covered, budget handled and the funder behind the programme.',
      achievements: 'Grants secured with amount and funder.',
    },
    verbs: ['Reached', 'Mobilised', 'Trained', 'Secured', 'Evaluated', 'Advocated'],
    metrics: ['beneficiaries', 'villages covered', 'grant amount', 'programme budget', 'retention'],
  },

  'defence-veteran': {
    name: 'Defence / Ex-servicemen',
    group: 'Legal & Public',
    template: 'executive',
    pages: [1, 2],
    order: ['summary', 'experience', 'achievements', 'skills', 'certifications', 'education', 'licences', 'languages', 'custom'],
    require: ['experience', 'education'],
    labels: { experience: 'Service Record', achievements: 'Awards & Commendations' },
    guidance: {
      summary: 'Translate rank and role into civilian terms. A hiring manager outside defence will not '
        + 'know what your appointment involved unless you say it plainly.',
      experience: 'Give the civilian equivalent of each posting: people managed, budget, assets, logistics scope.',
      skills: 'Security clearance level, if any, belongs here.',
    },
    verbs: ['Commanded', 'Coordinated', 'Trained', 'Maintained', 'Planned', 'Led'],
    metrics: ['personnel led', 'budget', 'assets managed', 'operations completed', 'years served'],
  },

  general: {
    name: 'General / Other',
    group: 'Early career',
    template: 'classic',
    pages: [1, 2],
    order: [...CORE, 'projects', 'certifications', 'achievements', 'languages', 'licences', 'publications', 'custom'],
    require: ['experience', 'education'],
    guidance: {
      experience: 'Whatever the field, the pattern holds: what you did, and what measurably changed.',
    },
    verbs: ['Managed', 'Improved', 'Delivered', 'Reduced', 'Trained', 'Coordinated'],
    metrics: ['cost', 'time saved', 'volume', 'team size', 'satisfaction score'],
  },
};

/**
 * Words people actually type that do not appear in a pack's name. "Nurse" does
 * not substring-match "Nursing", and nobody searches for "Health & Life
 * sciences". Extend freely - this only affects search.
 */
export const ALIASES = {
  'software-engineering': ['developer', 'programmer', 'coder', 'software', 'frontend', 'backend', 'full stack', 'web', 'react', 'java', 'python', 'sde', 'it'],
  'data-analytics': ['data scientist', 'analyst', 'machine learning', 'ml', 'ai', 'statistics', 'analytics', 'sql'],
  'product-management': ['product manager', 'pm', 'product owner'],
  design: ['designer', 'ux', 'ui', 'graphic', 'visual', 'figma'],
  marketing: ['marketer', 'seo', 'digital marketing', 'brand', 'growth', 'social media'],
  'sales-bd': ['salesman', 'saleswoman', 'sales executive', 'account executive', 'business development', 'quota'],
  'finance-accounting': ['accountant', 'chartered accountant', 'audit', 'auditor', 'finance', 'tax', 'controller'],
  consulting: ['consultant', 'strategy', 'advisory'],
  'healthcare-clinical': ['nurse', 'nursing', 'doctor', 'physician', 'icu', 'hospital', 'medical', 'ward', 'paramedic', 'midwife'],
  law: ['lawyer', 'advocate', 'attorney', 'legal', 'solicitor', 'barrister', 'bar'],
  'teaching-education': ['teacher', 'tutor', 'lecturer', 'school', 'education', 'faculty', 'principal'],
  'core-engineering': ['mechanical', 'civil', 'electrical', 'engineer', 'manufacturing', 'production', 'cad'],
  'operations-supply': ['operations', 'supply chain', 'logistics', 'warehouse', 'procurement', 'inventory'],
  'human-resources': ['hr', 'recruiter', 'recruitment', 'talent', 'people', 'hiring'],
  'academic-research': ['researcher', 'phd', 'postdoc', 'professor', 'scientist', 'academia'],
  'student-fresher': ['student', 'fresher', 'graduate', 'intern', 'entry level', 'no experience', 'college'],
  'government-psu': ['government', 'psu', 'sarkari', 'civil services', 'upsc', 'ssc', 'biodata', 'public sector'],
  cybersecurity: ['security', 'infosec', 'soc', 'pentester', 'penetration testing', 'cyber'],
  'it-support': ['support', 'helpdesk', 'help desk', 'sysadmin', 'system administrator', 'desktop'],
  architecture: ['architect', 'building design', 'revit', 'autocad'],
  agriculture: ['farmer', 'farming', 'agronomist', 'agri', 'crop', 'dairy', 'horticulture'],
  pharmacy: ['pharmacist', 'pharma', 'chemist', 'dispensing'],
  dentistry: ['dentist', 'dental', 'orthodontist'],
  physiotherapy: ['physio', 'physiotherapist', 'rehab', 'rehabilitation', 'sports therapy'],
  psychology: ['psychologist', 'counsellor', 'counselor', 'therapist', 'mental health'],
  'lab-technology': ['lab technician', 'laboratory', 'pathology', 'diagnostics', 'phlebotomist'],
  veterinary: ['vet', 'veterinarian', 'animal', 'livestock'],
  journalism: ['journalist', 'reporter', 'editor', 'news', 'media', 'press'],
  'film-animation': ['animator', 'vfx', 'film', 'video', 'motion', 'compositor', 'showreel'],
  'content-writing': ['writer', 'copywriter', 'content', 'blogger', 'technical writer'],
  hospitality: ['hotel', 'front office', 'housekeeping', 'concierge', 'tourism', 'travel'],
  culinary: ['chef', 'cook', 'kitchen', 'baker', 'catering', 'sous chef'],
  aviation: ['pilot', 'cabin crew', 'air hostess', 'flight attendant', 'airline', 'aircraft'],
  'retail-customer': ['retail', 'store', 'shop', 'cashier', 'customer service', 'call centre', 'call center', 'bpo'],
  'skilled-trades': ['electrician', 'plumber', 'welder', 'mechanic', 'fitter', 'carpenter', 'technician', 'iti', 'driver'],
  'banking-bfsi': ['bank', 'banker', 'branch manager', 'loan', 'credit', 'relationship manager'],
  'insurance-actuarial': ['actuary', 'actuarial', 'insurance', 'underwriter', 'claims'],
  'real-estate': ['property', 'realtor', 'broker', 'leasing', 'rera', 'estate agent'],
  'social-work-ngo': ['ngo', 'social worker', 'nonprofit', 'development sector', 'community'],
  'defence-veteran': ['army', 'navy', 'air force', 'military', 'soldier', 'veteran', 'ex-serviceman', 'defence', 'defense'],
  general: ['other', 'general', 'admin', 'administration', 'coordinator'],
};

export const PROFESSION_GROUPS = (() => {
  const groups = new Map();
  for (const [id, p] of Object.entries(PROFESSIONS)) {
    if (!groups.has(p.group)) groups.set(p.group, []);
    groups.get(p.group).push({ id, ...p });
  }
  return [...groups.entries()].map(([name, items]) => ({ name, items }));
})();

export function professionOf(settings) {
  return PROFESSIONS[settings.profession] || PROFESSIONS.general;
}

export function regionOf(settings) {
  return REGIONS[settings.region] || REGIONS.india;
}

// Whether personal details (DOB, marital status, gender) are acceptable here.
// The profession can override the region: an Indian PSU form asks for them.
export function personalDetailsRule(settings) {
  const prof = professionOf(settings);
  if (prof.personalDetailsExpected) return 'expected';
  return regionOf(settings).personalDetails;
}

// Applying a pack rewrites presentation only - section order, template, labels,
// which optional sections are visible. It never touches what the person wrote.
export function applyProfession(data, id) {
  const prof = PROFESSIONS[id] ? id : 'general';
  const pack = PROFESSIONS[prof];
  const s = data.settings;

  s.profession = prof;
  s.template = pack.template;
  s.labels = { ...(pack.labels || {}) };

  const seen = new Set();
  const order = [];
  for (const sid of pack.order || SECTION_IDS) {
    if (SECTION_IDS.includes(sid) && !seen.has(sid)) { seen.add(sid); order.push(sid); }
  }
  for (const sid of SECTION_IDS) if (!seen.has(sid)) order.push(sid);
  s.order = order;

  const asked = new Set([...(pack.require || []), ...(pack.recommend || [])]);
  s.shown = {};
  for (const sid of OPTIONAL_SECTIONS) s.shown[sid] = asked.has(sid);

  return data;
}

// Regions carry one hard consequence: whether a photo may appear at all.
export function applyRegion(data, id) {
  const region = REGIONS[id] ? id : 'india';
  data.settings.region = region;
  if (REGIONS[region].photo === 'forbidden') data.settings.showPhoto = false;
  return data;
}

export function sectionVisible(data, id) {
  if (!OPTIONAL_SECTIONS.includes(id)) return true;
  if (Array.isArray(data[id]) && data[id].length) return true;
  return Boolean(data.settings.shown && data.settings.shown[id]);
}

export function pageTarget(settings) {
  const prof = professionOf(settings);
  const reg = regionOf(settings);
  // Take the profession's floor and the more generous ceiling of the two, so a
  // US academic is not told to cut a 6-page CV to one page.
  return [Math.max(prof.pages[0], reg.pages[0]), Math.max(prof.pages[1], reg.pages[1])];
}
