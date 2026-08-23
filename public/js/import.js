// Reading an existing CV back in.
//
// Two stages, deliberately separate: get text out of the file, then find
// structure in the text. Both are best-effort, and the UI shows the result for
// correction rather than pretending it parsed perfectly. Everything runs in the
// browser - no upload, no server, no third-party parser.

import { blankData, SECTIONS } from './schema.js';

/* ============================ stage 1: file to text ====================== */

const DEC = new TextDecoder();

export async function fileToText(file) {
  const name = (file.name || '').toLowerCase();

  if (/\.(txt|md|markdown|csv)$/.test(name) || file.type.startsWith('text/')) {
    return { text: await file.text(), how: 'text file' };
  }
  if (/\.json$/.test(name)) {
    return { text: await file.text(), how: 'json', json: true };
  }
  if (/\.docx$/.test(name)) {
    const text = await docxToText(await file.arrayBuffer());
    if (!text) throw new ImportError('This .docx could not be opened. It may be a .doc renamed to .docx.');
    return { text, how: 'Word document' };
  }
  if (/\.pdf$/.test(name)) {
    const text = await pdfToText(await file.arrayBuffer());
    if (!text) {
      throw new ImportError(
        'The text in this PDF could not be read. That usually means it is a scan, or it uses '
        + 'embedded font encoding. Open the PDF, select all, copy, and paste into the box instead.',
      );
    }
    return { text, how: 'PDF' };
  }
  if (/\.doc$/.test(name)) {
    throw new ImportError('Old .doc files cannot be read here. Open it and save as .docx or PDF, '
      + 'or paste the text into the box.');
  }
  throw new ImportError('Unsupported file type. Use PDF, .docx, .txt, or paste the text.');
}

export class ImportError extends Error {}

/* ---- .docx: a zip containing word/document.xml -------------------------- */

async function inflate(bytes, raw) {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([bytes]).stream()
      .pipeThrough(new DecompressionStream(raw ? 'deflate-raw' : 'deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function docxToText(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // End of central directory: scan back for the 0x06054b50 signature.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return '';

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);

  for (let n = 0; n < count; n += 1) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compressed = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localAt = view.getUint32(p + 42, true);
    const entryName = DEC.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    if (entryName === 'word/document.xml') {
      if (view.getUint32(localAt, true) !== 0x04034b50) return '';
      const lNameLen = view.getUint16(localAt + 26, true);
      const lExtraLen = view.getUint16(localAt + 28, true);
      const start = localAt + 30 + lNameLen + lExtraLen;
      const raw = bytes.subarray(start, start + compressed);
      const xml = method === 0 ? raw : await inflate(raw, true);
      return xml ? xmlToText(DEC.decode(xml)) : '';
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return '';
}

function xmlToText(xml) {
  return xml
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\r/g, '');
}

/* ---- PDF: best effort over uncompressed content streams ----------------- */

async function pdfToText(buffer) {
  const bytes = new Uint8Array(buffer);
  const ascii = latin1(bytes);
  const chunks = [];

  // The leading boundary matters: without it this also matches the "stream"
  // inside "endstream" and starts decoding from the middle of a stream.
  const re = /(?:^|[^a-zA-Z])stream\r?\n?/g;
  let m;
  while ((m = re.exec(ascii)) !== null) {
    const start = m.index + m[0].length;
    const end = ascii.indexOf('endstream', start);
    if (end < 0) continue;
    const slice = bytes.subarray(start, end);
    // zlib-wrapped (FlateDecode) streams start 0x78; try raw bytes otherwise.
    const out = slice[0] === 0x78 ? await inflate(slice, false) : slice;
    if (out) chunks.push(latin1(out));
    re.lastIndex = end;
  }

  const text = chunks.map(extractPdfText).join('\n');
  return looksLikeProse(text) ? tidy(text) : '';
}

function latin1(bytes) {
  let s = '';
  const step = 8192;
  for (let i = 0; i < bytes.length; i += step) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return s;
}

// Pull the string operands of Tj / TJ / ' / " out of a content stream.
function extractPdfText(content) {
  if (!/(Tj|TJ)\b/.test(content)) return '';
  let out = '';
  let i = 0;

  const readString = () => {
    let depth = 1;
    let s = '';
    i += 1;
    while (i < content.length && depth > 0) {
      const c = content[i];
      if (c === '\\') {
        const next = content[i + 1];
        const map = { n: '\n', r: '', t: '\t', b: '', f: '', '(': '(', ')': ')', '\\': '\\' };
        if (next >= '0' && next <= '7') {
          const oct = content.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)[0];
          s += String.fromCharCode(parseInt(oct, 8));
          i += 1 + oct.length;
          continue;
        }
        s += map[next] !== undefined ? map[next] : next;
        i += 2;
        continue;
      }
      if (c === '(') { depth += 1; s += c; i += 1; continue; }
      if (c === ')') { depth -= 1; if (depth) s += c; i += 1; continue; }
      s += c;
      i += 1;
    }
    return s;
  };

  while (i < content.length) {
    const c = content[i];
    if (c === '(') { out += readString(); continue; }
    if (c === 'T' && (content[i + 1] === 'd' || content[i + 1] === 'D' || content[i + 1] === '*')) {
      out += '\n'; i += 2; continue;
    }
    if (content.startsWith('ET', i)) { out += '\n'; i += 2; continue; }
    i += 1;
  }
  return out;
}

// Identity-H and other custom encodings decode to control characters. If the
// result is not mostly readable, say so rather than hand back mojibake.
function looksLikeProse(s) {
  if (s.replace(/\s/g, '').length < 80) return false;
  const good = (s.match(/[A-Za-z0-9 .,@+()/&:'-]/g) || []).length;
  return good / s.length > 0.72;
}

function tidy(s) {
  return s.replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map((l) => l.trim()).join('\n')
    .trim();
}

/* ========================= stage 2: text to structure ==================== */

const HEADINGS = [
  ['summary', ['summary', 'profile', 'objective', 'career objective', 'professional summary',
    'about me', 'about', 'personal statement', 'career summary', 'professional profile', 'overview']],
  ['experience', ['experience', 'work experience', 'professional experience', 'employment',
    'employment history', 'work history', 'career history', 'professional background',
    'relevant experience', 'clinical experience', 'teaching experience', 'legal experience',
    'academic appointments', 'internships', 'internship experience']],
  ['education', ['education', 'academic qualifications', 'academics', 'qualifications',
    'educational qualifications', 'academic background', 'education & training']],
  ['skills', ['skills', 'technical skills', 'key skills', 'core competencies', 'competencies',
    'areas of expertise', 'skill set', 'technical proficiencies', 'clinical skills', 'expertise']],
  ['projects', ['projects', 'key projects', 'personal projects', 'selected work', 'portfolio',
    'academic projects', 'project work', 'selected projects']],
  ['certifications', ['certifications', 'certificates', 'courses', 'training',
    'professional development', 'certifications & training']],
  ['licences', ['licences', 'licenses', 'licensure', 'registration', 'bar admission',
    'professional registration', 'licences & registrations']],
  ['publications', ['publications', 'papers', 'research', 'research publications',
    'conference papers', 'journal articles', 'selected publications']],
  ['achievements', ['achievements', 'awards', 'honours', 'honors', 'accomplishments',
    'awards & honours', 'awards and honors', 'extracurricular', 'activities',
    'grants', 'grants & awards', 'positions of responsibility']],
  ['languages', ['languages', 'language proficiency', 'languages known']],
];

const HEADING_LOOKUP = (() => {
  const map = new Map();
  for (const [id, names] of HEADINGS) for (const n of names) map.set(n, id);
  return map;
})();

const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const DATE_TOKEN = new RegExp(
  `(${MONTH}\\s*'?\\d{2,4}|\\d{1,2}[/.-]\\d{4}|\\b(?:19|20)\\d{2}\\b|present|current|till\\s*date|to\\s*date|ongoing|now)`,
  'gi',
);
const BULLET_START = /^\s*[•·▪‣◦*\-–—o]\s+/;

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function headingId(line) {
  const t = clean(line).replace(/[:•\-–—_]+$/, '').trim().toLowerCase();
  if (!t || t.length > 42 || t.split(/\s+/).length > 5) return null;
  if (HEADING_LOOKUP.has(t)) return HEADING_LOOKUP.get(t);
  // "WORK EXPERIENCE" in caps with stray punctuation
  const squashed = t.replace(/[^a-z& ]/g, '').trim();
  return HEADING_LOOKUP.get(squashed) || null;
}

function splitDates(line) {
  const matches = [...String(line).matchAll(DATE_TOKEN)];
  if (!matches.length) return { rest: clean(line), start: '', end: '', current: false };

  const first = matches[0];
  const last = matches[matches.length - 1];
  const startTok = clean(first[0]);
  const endTok = matches.length > 1 ? clean(last[0]) : '';
  const current = /present|current|till|to date|ongoing|now/i.test(endTok || startTok);

  const from = first.index;
  const to = last.index + last[0].length;
  const rest = clean((line.slice(0, from) + ' ' + line.slice(to)).replace(/[|,\-–—]+\s*$/, ''));

  return {
    rest,
    start: matches.length > 1 ? startTok : (current ? '' : startTok),
    end: current ? '' : endTok,
    current,
  };
}

function splitPair(text) {
  for (const sep of [' | ', ' – ', ' — ', ' at ', ' @ ', ' - ', ', ']) {
    const i = text.toLowerCase().indexOf(sep.toLowerCase());
    if (i > 0) return [clean(text.slice(0, i)), clean(text.slice(i + sep.length))];
  }
  return [clean(text), ''];
}

function sectionise(text) {
  const rawLines = String(text).split('\n').map((l) => l.replace(/\s+$/, ''));
  const head = [];
  const sections = [];
  let current = null;

  for (const line of rawLines) {
    if (!clean(line)) { if (current) current.lines.push(''); continue; }
    const id = headingId(line);
    if (id) {
      current = { id, lines: [] };
      sections.push(current);
      continue;
    }
    (current ? current.lines : head).push(line);
  }
  return { head, sections };
}

function parseContact(headLines, wholeText) {
  const basics = {};
  const email = wholeText.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
  if (email) basics.email = email[0];

  const phone = wholeText.match(/(\+\d{1,3}[\s-]?)?(\(?\d{2,5}\)?[\s-]?){2,4}\d{2,4}/g);
  if (phone) {
    const best = phone.map(clean).filter((p) => p.replace(/\D/g, '').length >= 8)
      .sort((a, b) => b.length - a.length)[0];
    if (best) basics.phone = best;
  }

  // Strip emails first, or the domain half of an address is read as a website.
  const noEmails = wholeText.replace(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, ' ');
  const links = noEmails.match(/(https?:\/\/)?(www\.)?[\w-]+\.[\w./%-]{2,}/gi) || [];
  for (const raw of links) {
    const l = raw.replace(/[.,;)]+$/, '');
    if (/@/.test(l)) continue;
    if (/linkedin\./i.test(l) && !basics.linkedin) basics.linkedin = l;
    else if (/github\.|gitlab\./i.test(l) && !basics.github) basics.github = l;
    else if (!basics.website && !/\.(pdf|docx?|png|jpe?g)$/i.test(l) && /\.[a-z]{2,}$/i.test(l)) {
      basics.website = l;
    }
  }

  // Name: the first line that reads like a person rather than contact data.
  for (const line of headLines.slice(0, 6)) {
    const t = clean(line);
    if (!t || t.length > 48) continue;
    if (/[@\d]/.test(t)) continue;
    const w = t.split(' ');
    if (w.length < 2 || w.length > 5) continue;
    basics.fullName = t;
    break;
  }
  // Location: the "City, Country" shape, usually sitting in the contact line
  // among pipe-separated fragments.
  const CITY = /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2},\s*[A-Z][A-Za-z.'-]+(?:\s+[A-Za-z.'-]+){0,2}$/;
  outer: for (const line of headLines.slice(0, 8)) {
    for (const seg of line.split(/[|•·]/)) {
      const t = clean(seg);
      if (!t || t.length > 44 || /[@\d]/.test(t)) continue;
      if (t === basics.fullName) continue;
      if (CITY.test(t)) { basics.location = t; break outer; }
    }
  }

  // Headline: a short following line that is not contact detail.
  const nameAt = headLines.findIndex((l) => clean(l) === basics.fullName);
  for (const line of headLines.slice(nameAt + 1, nameAt + 4)) {
    const t = clean(line);
    if (!t || t.length > 70 || /[@]/.test(t) || t.replace(/\D/g, '').length > 5) continue;
    basics.headline = t;
    break;
  }
  return basics;
}

// A line that opens a new entry: carries a date, or is short and title-like
// while the following line looks like detail.
function isEntryHead(line, next) {
  if (BULLET_START.test(line)) return false;
  const t = clean(line);
  if (!t) return false;
  if (DATE_TOKEN.test(t)) { DATE_TOKEN.lastIndex = 0; return true; }
  DATE_TOKEN.lastIndex = 0;
  return t.length < 70 && Boolean(next) && BULLET_START.test(next);
}

function parseEntries(lines, build) {
  const out = [];
  let cur = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!clean(line)) continue;
    if (isEntryHead(line, lines[i + 1])) {
      cur = build(line);
      out.push(cur);
    } else if (cur) {
      cur.__bullets.push(clean(line).replace(BULLET_START, ''));
    } else {
      cur = build(line);
      out.push(cur);
    }
  }
  return out;
}

function parseExperience(lines) {
  return parseEntries(lines, (line) => {
    const { rest, start, end, current } = splitDates(line);
    const [a, b] = splitPair(rest);
    return { role: a, company: b, location: '', start, end, current, bullets: '', __bullets: [] };
  }).map((e) => {
    const { __bullets, ...rest } = e;
    return { ...rest, bullets: __bullets.join('\n') };
  });
}

function parseEducation(lines) {
  return parseEntries(lines, (line) => {
    const { rest, start, end } = splitDates(line);
    const [a, b] = splitPair(rest);
    return { degree: a, school: b, location: '', start, end, score: '', details: '', __bullets: [] };
  }).map((e) => {
    const { __bullets, ...rest } = e;
    const score = __bullets.find((l) => /cgpa|gpa|%|percent|first class|distinction|division/i.test(l));
    return {
      ...rest,
      score: score ? clean(score) : '',
      details: __bullets.filter((l) => l !== score).join('\n'),
    };
  });
}

function parseProjects(lines) {
  return parseEntries(lines, (line) => {
    const { rest, start } = splitDates(line);
    const [a, b] = splitPair(rest);
    return { name: a, tech: b, link: '', date: start, bullets: '', __bullets: [] };
  }).map((e) => {
    const { __bullets, ...rest } = e;
    const link = __bullets.find((l) => /https?:|github\.|\.com|\.dev|\.io/i.test(l));
    return {
      ...rest,
      link: link ? clean(link) : '',
      bullets: __bullets.filter((l) => l !== link).join('\n'),
    };
  });
}

function parseSkills(lines) {
  const groups = [];
  let loose = [];
  for (const raw of lines) {
    const line = clean(raw).replace(BULLET_START, '');
    if (!line) continue;
    const m = line.match(/^([A-Za-z][\w &/+-]{1,34}?)\s*[:–—-]\s*(.+)$/);
    if (m && m[2].includes(',')) groups.push({ group: clean(m[1]), items: clean(m[2]) });
    else loose.push(line);
  }
  if (loose.length) {
    const items = loose.join(', ').split(/[,;|•·]/).map(clean).filter(Boolean);
    if (items.length) groups.push({ group: groups.length ? 'Other' : 'Skills', items: items.join(', ') });
  }
  return groups;
}

function parseLanguages(lines) {
  const out = [];
  const levels = ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic'];
  const flat = lines.map((l) => clean(l).replace(BULLET_START, '')).filter(Boolean).join(', ');
  for (const chunk of flat.split(/[,;|]/)) {
    const t = clean(chunk);
    if (!t) continue;
    const m = t.match(/^([A-Za-z ]{2,20}?)\s*[-–—(:]\s*([A-Za-z ]+)\)?$/);
    if (m) {
      const want = clean(m[2]).toLowerCase();
      const level = levels.find((l) => l.toLowerCase().startsWith(want.slice(0, 4))) || 'Fluent';
      out.push({ name: clean(m[1]), level });
    } else if (/^[A-Za-z ]{2,20}$/.test(t)) {
      out.push({ name: t, level: 'Fluent' });
    }
  }
  return out;
}

function parseSimpleList(lines, build) {
  const out = [];
  for (const raw of lines) {
    const line = clean(raw).replace(BULLET_START, '');
    if (line) out.push(build(line));
  }
  return out;
}

/**
 * Parse plain CV text into the app's data shape.
 * Returns { data, report } - the report drives the confirmation screen, because
 * a parser like this is right most of the time and wrong often enough to matter.
 */
export function parseCV(text, base) {
  const data = base ? JSON.parse(JSON.stringify(base)) : blankData();
  const { head, sections } = sectionise(text);
  const found = [];
  const notes = [];

  Object.assign(data.basics, parseContact(head, text));

  // Text before the first heading, beyond the contact block, is usually a summary.
  const headProse = head.map(clean).filter((l) => l && l !== data.basics.fullName
    && l !== data.basics.headline && !/[@]/.test(l) && l.split(' ').length > 6);
  if (headProse.length) data.basics.summary = headProse.join('\n');

  for (const sec of sections) {
    const lines = sec.lines;
    const body = lines.map(clean).filter(Boolean);
    if (!body.length) continue;

    switch (sec.id) {
      case 'summary':
        data.basics.summary = body.map((l) => l.replace(BULLET_START, '')).join('\n');
        found.push('summary');
        break;
      case 'experience': {
        const items = parseExperience(lines);
        if (items.length) { data.experience.push(...items); found.push('experience'); }
        break;
      }
      case 'education': {
        const items = parseEducation(lines);
        if (items.length) { data.education.push(...items); found.push('education'); }
        break;
      }
      case 'projects': {
        const items = parseProjects(lines);
        if (items.length) { data.projects.push(...items); found.push('projects'); }
        break;
      }
      case 'skills': {
        const items = parseSkills(lines);
        if (items.length) { data.skills.push(...items); found.push('skills'); }
        break;
      }
      case 'languages': {
        const items = parseLanguages(lines);
        if (items.length) { data.languages.push(...items); found.push('languages'); }
        break;
      }
      case 'certifications':
        data.certifications.push(...parseSimpleList(body, (l) => {
          const { rest, start } = splitDates(l);
          const [a, b] = splitPair(rest || l);
          return { name: a || l, issuer: b, year: start, link: '' };
        }));
        found.push('certifications');
        break;
      case 'licences':
        data.licences.push(...parseSimpleList(body, (l) => {
          const num = l.match(/\b([A-Z]{0,4}[-/]?\d{4,})\b/);
          return { name: clean(l.replace(num ? num[0] : '', '')) || l, authority: '', number: num ? num[1] : '', expiry: '' };
        }));
        found.push('licences');
        break;
      case 'publications':
        data.publications.push(...parseSimpleList(body, (l) => {
          const year = l.match(/\b(19|20)\d{2}\b/);
          return { title: l, venue: '', year: year ? year[0] : '', link: '' };
        }));
        found.push('publications');
        break;
      case 'achievements':
        data.achievements.push(...parseSimpleList(body, (l) => ({ text: l })));
        found.push('achievements');
        break;
      default:
        break;
    }
  }

  if (!sections.length) {
    notes.push('No section headings were recognised, so everything went into the summary. '
      + 'Add headings like "Experience" and "Education" to the pasted text and try again, '
      + 'or fill the sections in by hand.');
    if (!data.basics.summary) data.basics.summary = tidy(text).slice(0, 1200);
  }
  if (!data.experience.length && !found.includes('experience')) {
    notes.push('No work experience was found. If your CV has it, the heading may be worded unusually.');
  }
  if (data.experience.some((e) => !e.start)) {
    notes.push('Some roles came through without dates - check them before exporting.');
  }

  const counts = {};
  for (const id of Object.keys(SECTIONS)) {
    if (Array.isArray(data[id])) counts[id] = data[id].length;
  }

  return {
    data,
    report: {
      found: [...new Set(found)],
      counts,
      notes,
      name: data.basics.fullName || '',
      chars: text.length,
    },
  };
}
