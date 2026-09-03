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
  if (/\.zip$/.test(name)) {
    // A LinkedIn archive holds a lot more than a CV - messages, connections,
    // ad targeting, their inferences about you. Only the profile files are
    // opened, and the report names which ones, so nothing is read quietly.
    const files = await unzip(await file.arrayBuffer(), isProfileCsv);
    const csvs = {};
    for (const [path, text] of Object.entries(files)) {
      csvs[path.split('/').pop().toLowerCase()] = text;
    }
    if (!Object.keys(csvs).length) {
      throw new ImportError('No LinkedIn profile files were found in that zip. The archive should '
        + 'contain Profile.csv and Positions.csv. If you picked the "Connections only" export, '
        + 'request the full one instead - or use the quicker route: your LinkedIn profile, '
        + 'More, Save to PDF.');
    }
    return { csvs, how: 'LinkedIn archive' };
  }
  if (/\.doc$/.test(name)) {
    throw new ImportError('Old .doc files cannot be read here. Open it and save as .docx or PDF, '
      + 'or paste the text into the box.');
  }
  throw new ImportError('Unsupported file type. Use PDF, .docx, .txt, a LinkedIn .zip archive, '
    + 'or paste the text.');
}

export class ImportError extends Error {}

/* ---- .docx: a zip containing word/document.xml -------------------------- */

/**
 * Inflate, tolerantly.
 *
 * A PDF stream is delimited by the `endstream` keyword, but the bytes before it
 * usually include the writer's end-of-line - and unlike most zlib
 * implementations, DecompressionStream treats anything after the compressed
 * data as an error and throws away the whole result. Reading the stream by hand
 * keeps every chunk that arrived before the complaint, which is all of the real
 * content. Without this a perfectly readable LinkedIn PDF decoded to nothing.
 */
async function inflate(bytes, raw) {
  if (typeof DecompressionStream === 'undefined') return null;

  const attempt = async (mode) => {
    let reader;
    try {
      reader = new Blob([bytes]).stream()
        .pipeThrough(new DecompressionStream(mode))
        .getReader();
    } catch {
      return null;
    }
    const parts = [];
    let size = 0;
    try {
      for (;;) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        size += value.length;
      }
    } catch {
      // Trailing junk, or a truncated stream. Keep what decoded cleanly.
    }
    if (!size) return null;
    const out = new Uint8Array(size);
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  };

  for (const mode of raw ? ['deflate-raw', 'deflate'] : ['deflate', 'deflate-raw']) {
    // eslint-disable-next-line no-await-in-loop
    const out = await attempt(mode);
    if (out) return out;
  }
  return null;
}

/**
 * Walks a zip's central directory and decodes the entries `want` accepts.
 * Hand-written because a .docx and a LinkedIn archive are both zips, and
 * neither is worth a dependency. Returns { entryName: text }.
 */
async function unzip(buffer, want) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const out = {};

  // End of central directory: scan back for the 0x06054b50 signature.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return out;

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);

  for (let n = 0; n < count; n += 1) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compressed = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localAt = view.getUint32(p + 42, true);
    const entryName = DEC.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    if (want(entryName) && view.getUint32(localAt, true) === 0x04034b50) {
      const lNameLen = view.getUint16(localAt + 26, true);
      const lExtraLen = view.getUint16(localAt + 28, true);
      const start = localAt + 30 + lNameLen + lExtraLen;
      const raw = bytes.subarray(start, start + compressed);
      const body = method === 0 ? raw : await inflate(raw, true);
      if (body) out[entryName] = DEC.decode(body);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function docxToText(buffer) {
  const files = await unzip(buffer, (n) => n === 'word/document.xml');
  return files['word/document.xml'] ? xmlToText(files['word/document.xml']) : '';
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

/* ---- Identity-H fonts: the text is glyph ids, not characters -------------
 *
 * A PDF written with subset TrueType fonts (LinkedIn's export, and most things
 * produced by a browser) stores text as two-byte glyph indices rather than
 * letters. Reading the strings alone yields control characters, which is why
 * this used to give up. Every such font carries a /ToUnicode CMap that maps
 * those indices back, so the fix is to find it and use it.
 * ---------------------------------------------------------------------- */

const hexToChars = (hex) => {
  let s = '';
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    const code = parseInt(hex.slice(i, i + 4), 16);
    // 0000 and FFFF are .notdef placeholders, not text.
    if (code && code !== 0xFFFF) s += String.fromCharCode(code);
  }
  // A surrogate pair or a single non-BMP value arrives as 5+ hex digits.
  if (!s && hex.length && hex.length < 4) {
    const code = parseInt(hex, 16);
    if (code) s = String.fromCharCode(code);
  }
  return s;
};

function parseCMap(text) {
  const map = new Map();

  for (const block of text.match(/beginbfchar([\s\S]*?)endbfchar/g) || []) {
    const re = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let m;
    while ((m = re.exec(block)) !== null) map.set(parseInt(m[1], 16), hexToChars(m[2]));
  }

  for (const block of text.match(/beginbfrange([\s\S]*?)endbfrange/g) || []) {
    const re = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(\[[\s\S]*?\]|<[0-9A-Fa-f]+>)/g;
    let m;
    while ((m = re.exec(block)) !== null) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (m[3][0] === '[') {
        (m[3].match(/<([0-9A-Fa-f]+)>/g) || []).forEach((item, k) => {
          map.set(lo + k, hexToChars(item.slice(1, -1)));
        });
      } else {
        const base = parseInt(m[3].slice(1, -1), 16);
        // Guard the loop: a corrupt range could otherwise ask for millions.
        for (let c = lo; c <= hi && c - lo < 4096; c += 1) {
          const code = base + (c - lo);
          if (code && code !== 0xFFFF) map.set(c, String.fromCharCode(code));
        }
      }
    }
  }
  return map;
}

/** The decompressed stream belonging to object `num`, or ''. */
async function objectStream(bytes, ascii, num) {
  const at = new RegExp('(?:^|[^0-9])' + num + '\\s+0\\s+obj\\b').exec(ascii);
  if (!at) return '';
  const from = at.index;
  const objEnd = ascii.indexOf('endobj', from);
  const head = ascii.slice(from, objEnd < 0 ? from + 100000 : objEnd);
  const sm = /stream\r?\n?/.exec(head);
  if (!sm) return '';
  const start = from + sm.index + sm[0].length;
  const end = ascii.indexOf('endstream', start);
  if (end < 0) return '';
  const slice = bytes.subarray(start, end);
  const out = slice[0] === 0x78 ? await inflate(slice, false) : slice;
  return out ? latin1(out) : '';
}

/** { F15: Map(glyphId -> text) } keyed by the resource name used in `Tf`. */
async function buildCMaps(bytes, ascii) {
  const refs = {};
  for (const dict of ascii.match(/\/Font\s*<<([\s\S]{0,2000}?)>>/g) || []) {
    const re = /\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g;
    let m;
    while ((m = re.exec(dict)) !== null) refs[m[1]] = Number(m[2]);
  }

  const maps = {};
  for (const [name, num] of Object.entries(refs)) {
    const at = new RegExp('(?:^|[^0-9])' + num + '\\s+0\\s+obj\\b').exec(ascii);
    if (!at) continue;
    const objEnd = ascii.indexOf('endobj', at.index);
    const dict = ascii.slice(at.index, objEnd < 0 ? at.index + 4000 : objEnd);
    const tu = dict.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    if (!tu) continue;
    const parsed = parseCMap(await objectStream(bytes, ascii, Number(tu[1])));
    if (parsed.size) maps[name] = parsed;
  }
  return maps;
}

async function pdfToText(buffer) {
  const bytes = new Uint8Array(buffer);
  const ascii = latin1(bytes);
  const cmaps = await buildCMaps(bytes, ascii);
  const chunks = [];

  // The leading boundary matters: without it this also matches the "stream"
  // inside "endstream" and starts decoding from the middle of a stream.
  const re = /(?:^|[^a-zA-Z])stream\r?\n?/g;
  let m;
  while ((m = re.exec(ascii)) !== null) {
    const start = m.index + m[0].length;
    const end = ascii.indexOf('endstream', start);
    if (end < 0) continue;
    re.lastIndex = end;

    // An embedded font program is binary, and a big one reliably contains the
    // bytes "Tj" somewhere by chance - enough to be mistaken for a content
    // stream and drown the real text in mojibake. The object's own dictionary
    // says what it is: /Length1 means a font file, and images and metadata
    // announce themselves too.
    const objAt = ascii.lastIndexOf(' obj', m.index);
    const dict = objAt > 0 ? ascii.slice(objAt, m.index) : '';
    if (/\/Length1\b|\/Subtype\s*\/(Image|Type1C|CIDFontType0C)\b|\/Type\s*\/Metadata\b/.test(dict)) {
      continue;
    }

    const slice = bytes.subarray(start, end);
    // zlib-wrapped (FlateDecode) streams start 0x78; try raw bytes otherwise.
    const out = slice[0] === 0x78 ? await inflate(slice, false) : slice;
    if (out) chunks.push(latin1(out));
  }

  const text = chunks.map((c) => extractPdfText(c, cmaps)).join('\n');
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

/**
 * Pull the text out of a content stream.
 *
 * Word processors emit a separate text run for every formatting change, so an
 * ordinary line of a CV arrives as five or six runs. Breaking a line at every
 * `ET` therefore shredded words - "Subham" became "S" and "ubhamnagla". What
 * actually marks a new line is the text position moving down the page, so this
 * tracks it: `Tm` sets it outright, `Td`/`TD`/`T*` move it, and only a change
 * in Y ends the line.
 */
function extractPdfText(content, cmaps) {
  if (!/(Tj|TJ)\b/.test(content)) return '';

  const lines = [];
  let line = '';
  let font = '';        // resource name from the last `/Fxx ... Tf`
  let lastName = '';
  let nums = [];        // operands collected since the last operator
  let y = null;
  let inArray = false;
  let i = 0;

  const endLine = () => { if (line.trim()) lines.push(line.trim()); line = ''; };
  const moveTo = (newY) => {
    if (y !== null && Math.abs(newY - y) > 1.2) endLine();
    y = newY;
  };

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

    if (c === '(') { line += readString(); continue; }

    // A PDF name, so that "/F15 12 Tf" can set the current font.
    if (c === '/') {
      let j = i + 1;
      let name = '';
      while (j < content.length && /[A-Za-z0-9#+._-]/.test(content[j])) { name += content[j]; j += 1; }
      lastName = name;
      i = j;
      continue;
    }

    // <hex>: two-byte glyph ids under Identity-H. "<<" opens a dictionary.
    if (c === '<' && content[i + 1] !== '<') {
      const close = content.indexOf('>', i + 1);
      if (close < 0) { i += 1; continue; }
      const hex = content.slice(i + 1, close).replace(/[^0-9A-Fa-f]/g, '');
      const map = cmaps && cmaps[font];
      if (map) {
        for (let k = 0; k + 4 <= hex.length; k += 4) {
          const ch = map.get(parseInt(hex.slice(k, k + 4), 16));
          if (ch !== undefined) line += ch;
        }
      }
      i = close + 1;
      continue;
    }

    if (c === '[') { inArray = true; i += 1; continue; }
    if (c === ']') { inArray = false; i += 1; continue; }

    // A number: an operand, and inside a TJ array also a possible word gap.
    if (/[0-9+.-]/.test(c) && /^[+-]?(\d+\.?\d*|\.\d+)/.test(content.slice(i, i + 24))) {
      const num = /^[+-]?(\d+\.?\d*|\.\d+)/.exec(content.slice(i, i + 24))[0];
      const value = parseFloat(num);
      if (inArray && value <= -120 && line && !/\s$/.test(line)) line += ' ';
      nums.push(value);
      i += num.length;
      continue;
    }

    // An operator.
    if (/[A-Za-z'"*]/.test(c)) {
      let j = i;
      let op = '';
      while (j < content.length && /[A-Za-z0-9*'"]/.test(content[j])) { op += content[j]; j += 1; }
      i = j || i + 1;

      if (op === 'Tf') font = lastName;
      else if (op === 'Tm' && nums.length >= 6) moveTo(nums[nums.length - 1]);
      else if ((op === 'Td' || op === 'TD') && nums.length >= 2) {
        const ty = nums[nums.length - 1];
        if (Math.abs(ty) > 1.2) endLine();
        y = y === null ? ty : y + ty;
      } else if (op === 'T*' || op === "'" || op === '"') endLine();
      // `BT` deliberately does nothing here. A word processor wraps every run
      // in its own BT/ET pair, so ending the line at one split words down the
      // middle; the `Tm` inside each pair says whether the line really moved.

      nums = [];
      continue;
    }

    i += 1;
  }

  endLine();
  return lines.join('\n');
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
    'about me', 'about', 'personal statement', 'career summary', 'professional profile', 'overview',
    'profile summary', 'career profile', 'executive summary', 'career snapshot',
    'professional snapshot', 'snapshot', 'career overview', 'introduction']],
  ['experience', ['experience', 'work experience', 'professional experience', 'employment',
    'employment history', 'work history', 'career history', 'professional background',
    'relevant experience', 'clinical experience', 'teaching experience', 'legal experience',
    'academic appointments', 'internships', 'internship experience',
    'employment record', 'work record', 'career record', 'professional employment',
    'experience summary', 'organisational experience', 'organizational experience']],
  ['education', ['education', 'academic qualifications', 'academics', 'qualifications',
    'educational qualifications', 'academic background', 'education & training']],
  ['skills', ['skills', 'technical skills', 'key skills', 'core competencies', 'competencies',
    'areas of expertise', 'skill set', 'technical proficiencies', 'clinical skills', 'expertise',
    'soft skills', 'secondary skills', 'primary skills', 'core skills', 'technical expertise']],
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

// The same names with every space taken out, for headings that arrive one
// character at a time. See letterSpaced below.
const SQUASHED_LOOKUP = (() => {
  const map = new Map();
  for (const [id, names] of HEADINGS) {
    for (const n of names) map.set(n.replace(/[^a-z&]/g, ''), id);
  }
  return map;
})();

const MONTH = '\\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
// Each word alternative carries its own boundaries. Without them "now" matched
// inside "knowledge" and the date splitter cut the middle out of the word - on
// a CV, of all documents, where "knowledge" is not a rare word. "current" did
// the same to "concurrent".
const DATE_TOKEN = new RegExp(
  `(${MONTH}\\s*'?\\d{2,4}|\\d{1,2}[/.-]\\d{4}|\\b(?:19|20)\\d{2}\\b`
  + '|\\b(?:present|current|till\\s*date|to\\s*date|ongoing|now)\\b)',
  'gi',
);
const BULLET_START = /^\s*[•·▪‣◦*\-–—o→⇒➔➤►▶✓✔❖]\s+/;

// A row of rules under a heading. Left in, it becomes the first entry of the
// section and everything real is pushed into a second one.
const RULE_LINE = /^[_\-–—=~.·*─-╿\s]{3,}$/;

// A job title almost always contains one of these; a company name almost never
// does. It is the only thing that tells "Product Manager / Flipkart" apart from
// "Infosys / Systems Engineer", which are the same shape and opposite meanings.
const ROLE_WORD = new RegExp('\\b(?:engineer|manager|developer|analyst|consultant|designer'
  + '|director|lead|head|officer|executive|associate|specialist|administrator|architect'
  + '|scientist|nurse|doctor|physician|surgeon|teacher|lecturer|professor|accountant'
  + '|intern|trainee|technician|supervisor|coordinator|president|partner|chef|pilot'
  + '|advocate|lawyer|solicitor|pharmacist|therapist|assistant|clerk|operator|founder'
  + '|strategist|recruiter|auditor|planner|writer|editor|programmer|tester|volunteer)\\b', 'i');

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// A CV template that letter-spaces its headings comes out of a PDF one
// character at a time: "W O R K  E X P E R I E N C E". On the page the gap
// between words is wider, but it arrives as the same single space, so the word
// boundaries cannot be recovered - which is why the joined form is matched
// against heading names with their spaces removed rather than by trying to put
// the gaps back.
//
// Most tokens being one character is the signature. A real heading never looks
// like this, and the result still has to match a known name, so a line of
// initials cannot become a section by accident.
function letterSpaced(t) {
  const parts = t.split(/\s+/);
  if (parts.length < 4) return '';
  if (parts.filter((p) => p.length === 1).length / parts.length < 0.8) return '';
  const joined = parts.join('').replace(/[^a-z&]/g, '');
  return joined.length >= 4 && joined.length <= 40 ? joined : '';
}

function headingId(line) {
  const t = clean(line).replace(/[:•\-–—_]+$/, '').trim().toLowerCase();
  if (!t) return null;

  // Checked before the word-count guard below, which a spaced-out heading
  // fails on every time: "W O R K E X P E R I E N C E" is fourteen words.
  const spaced = letterSpaced(t);
  if (spaced) return SQUASHED_LOOKUP.get(spaced) || null;

  if (t.length > 42 || t.split(/\s+/).length > 5) return null;
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

  // A template that prints its sidebar before its header puts the name well
  // down the page, past where the loop above looks, and the CV imports with an
  // empty header - the checker then reports a missing name that is plainly
  // there on the PDF.
  //
  // The email is the way back to it: oupamyabanerjee@gmail.com and
  // "OUPAMYA BANERJEE" reduce to the same letters, and nothing else on a page
  // does that by accident. Guessing from capitalisation instead would cheerfully
  // decide that someone is called "Technologies Used".
  if (!basics.fullName && basics.email) {
    const local = basics.email.split('@')[0].replace(/[^a-z]/gi, '').toLowerCase();
    if (local.length >= 5) {
      for (const raw of String(wholeText).split('\n')) {
        const t = clean(raw);
        if (!t || t.length > 48 || /[@\d]/.test(t)) continue;
        const w = t.split(' ');
        if (w.length < 2 || w.length > 5) continue;
        if (t.replace(/[^a-z]/gi, '').toLowerCase() === local) {
          basics.fullName = t;
          break;
        }
      }
    }
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
    // A letter-spaced section heading is short enough to pass every test above.
    // On a template whose sidebar prints first, "C O N T A C T D E T A I L S"
    // is the very first line, and it was landing in the headline field.
    if (letterSpaced(t.toLowerCase())) continue;
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

// A range printed on its own line belongs to the entry above it, not to a new
// one. "Product Manager / Flipkart / June 2021 - August 2024" is one job
// written over three lines; read as three heads it became two jobs and lost
// both the employer and the dates.
function absorbDates(cur, t) {
  if (!cur || cur.start) return false;
  const { rest, start, end, current } = splitDates(t);
  // A sentence that merely mentions a year is a bullet, not a date line.
  if (!start || rest.length > 24) return false;

  cur.start = start;
  cur.end = end;
  if ('current' in cur) cur.current = current;

  // The line between the head and the dates is the other half of the pair -
  // employer, or title, depending which way round this CV writes them.
  const pending = cur.__bullets.length === 1 ? cur.__bullets[0] : '';
  const first = cur.role || cur.degree || '';
  // Not `cur.company || cur.school`: an experience entry has no school key at
  // all, so an empty company fell through to undefined and never looked empty.
  const other = 'company' in cur ? cur.company : cur.school;
  if (pending && other === '') {
    cur.__bullets.shift();
    if (ROLE_WORD.test(first) || !ROLE_WORD.test(pending)) {
      if ('company' in cur) cur.company = pending; else cur.school = pending;
    } else if ('company' in cur) {
      cur.company = first;
      cur.role = pending;
    } else {
      cur.school = first;
      cur.degree = pending;
    }
  } else if (rest && other === '') {
    if ('company' in cur) cur.company = rest; else cur.school = rest;
  }
  return true;
}

function parseEntries(lines, build, absorb) {
  const out = [];
  let cur = null;
  for (let i = 0; i < lines.length; i += 1) {
    const t = clean(lines[i]);
    if (!t || RULE_LINE.test(t)) continue;
    if (isEntryHead(lines[i], lines[i + 1])) {
      if (absorb && absorbDates(cur, t)) continue;
      cur = build(lines[i]);
      out.push(cur);
    } else if (cur) {
      cur.__bullets.push(t.replace(BULLET_START, ''));
    } else {
      cur = build(lines[i]);
      out.push(cur);
    }
  }
  return out;
}

/* --------------------------------------------- experience, labelled style */

// Common across Indian CVs and plenty of others: each job is a little block of
// "Label : Value" lines rather than one title-and-dates line. The generic
// splitter cannot read these - it starts a new job at "Responsibilities:",
// because the line is short and the next one is a bullet, so one job becomes
// four and the employer is never found.
const EXP_LABEL = {
  company: /^(?:entity|company|organi[sz]ation|organisation name|employer|firm)\s*[:\-–]\s*(.+)$/i,
  role: /^(?:role|designation|position|job title|title)\s*[:\-–]\s*(.+)$/i,
  location: /^(?:location|based (?:in|at)|place|city)\s*[:\-–]\s*(.+)$/i,
  dates: /^(?:duration|period|tenure|dates?)\s*[:\-–]\s*(.+)$/i,
};

// "Current organization:" with nothing after it separates one job from the
// next rather than naming anything.
const ORG_DIVIDER =
  /^(?:current|previous|prior|past|latest|recent)\s+(?:organi[sz]ation|employer|company)\s*[:\-–]?\s*$/i;

// A label that introduces detail belonging to the job above it. Left in as
// context would only repeat itself on every entry, so it is dropped.
const DETAIL_LABEL =
  /^(?:responsibilities|key responsibilities|roles?\s*(?:and|&)\s*responsibilities|duties|project|projects|description)\s*[:\-–]?\s*$/i;

function looksLabelled(lines) {
  let hits = 0;
  for (const l of lines) {
    const t = clean(l);
    if (EXP_LABEL.company.test(t) || EXP_LABEL.role.test(t)) hits += 1;
    if (hits >= 2) return true;
  }
  return false;
}

function parseLabelledExperience(lines) {
  const out = [];
  let cur = null;
  const open = () => {
    cur = { role: '', company: '', location: '', start: '', end: '', current: false, __b: [] };
    out.push(cur);
    return cur;
  };

  for (const raw of lines) {
    const t = clean(raw);
    if (!t) continue;

    if (ORG_DIVIDER.test(t)) { cur = null; continue; }
    if (DETAIL_LABEL.test(t)) continue;

    const co = t.match(EXP_LABEL.company);
    if (co) {
      // A second employer means a second job, even without a divider between.
      if (!cur || cur.company) open();
      cur.company = clean(co[1]);
      continue;
    }

    const role = t.match(EXP_LABEL.role);
    if (role) {
      if (!cur || cur.role) open();
      cur.role = clean(role[1]);
      continue;
    }

    const loc = t.match(EXP_LABEL.location);
    if (loc) { (cur || open()).location = clean(loc[1]); continue; }

    const dl = t.match(EXP_LABEL.dates);
    const dateSource = dl ? clean(dl[1]) : t;
    const { rest, start, end, current } = splitDates(dateSource);
    // A line that is mostly dates sets the range; one that merely mentions a
    // year in a sentence is a bullet and keeps its text.
    if (start && (dl || rest.length <= 24)) {
      const e = cur || open();
      if (!e.start) { e.start = start; e.end = end; e.current = current; }
      if (!e.role && rest && !dl) e.role = rest;
      continue;
    }

    (cur || open()).__b.push(t.replace(BULLET_START, ''));
  }

  return out.map(({ __b, ...rest }) => ({ ...rest, bullets: __b.join('\n') }));
}

function parseExperience(lines) {
  if (looksLabelled(lines)) return parseLabelledExperience(lines);
  return parseEntries(lines, (line) => {
    const { rest, start, end, current } = splitDates(line);
    const [a, b] = splitPair(rest);
    return { role: a, company: b, location: '', start, end, current, bullets: '', __bullets: [] };
  }, true).map((e) => {
    const { __bullets, ...rest } = e;
    return { ...rest, bullets: __bullets.join('\n') };
  });
}

function parseEducation(lines) {
  return parseEntries(lines, (line) => {
    const { rest, start, end } = splitDates(line);
    const [a, b] = splitPair(rest);
    return { degree: a, school: b, location: '', start, end, score: '', details: '', __bullets: [] };
  }, true).map((e) => {
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
  // A LinkedIn export has a layout we can read exactly rather than guess at, so
  // it gets its own parser. If that finds no roles the generic path is better,
  // and we fall through to it.
  if (looksLikeLinkedIn(text)) {
    const li = parseLinkedInPdf(text, base);
    if (li.data.experience.length || li.data.education.length) return li;
  }

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

/* ============================== LinkedIn ================================
 *
 * Two routes in, both handed over by the person themselves. There is no third:
 * no public API returns a member's positions or education, and scraping
 * breaches LinkedIn's terms and risks their account, not ours.
 *
 *   1. Profile -> More -> Save to PDF. Instant, and the layout is fixed enough
 *      to parse properly rather than guess at.
 *   2. Settings -> Data privacy -> Get a copy of your data. Cleaner data, but
 *      10 minutes to 72 hours to arrive, so it is the second route.
 * ---------------------------------------------------------------------- */

const LI_CSVS = ['profile', 'positions', 'education', 'skills', 'certifications',
  'languages', 'projects', 'email addresses', 'phone numbers', 'honors', 'publications'];

/** Only the profile files. The rest of the archive is none of our business. */
function isProfileCsv(path) {
  const file = path.split('/').pop().toLowerCase();
  if (!file.endsWith('.csv')) return false;
  const stem = file.slice(0, -4);
  return LI_CSVS.some((n) => stem === n || stem.startsWith(n));
}

/** RFC 4180 enough for LinkedIn: quoted fields, commas and newlines inside them. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');

  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(cell); cell = ''; continue; }
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim()));
}

/**
 * Turns a CSV into objects. LinkedIn puts a "Notes:" preamble above the header
 * in some files, so the header is the first row carrying an expected column
 * rather than simply the first row.
 */
function csvRows(text, expect) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const wanted = expect.map((e) => e.toLowerCase());
  let at = rows.findIndex((r) => r.some((c) => wanted.includes(clean(c).toLowerCase())));
  if (at < 0) at = 0;
  const head = rows[at].map((h) => clean(h).toLowerCase());
  return rows.slice(at + 1).map((r) => {
    const o = {};
    // Trimmed, not cleaned: a Description field carries the line breaks that
    // become the bullets, and collapsing whitespace here would lose them.
    head.forEach((h, i) => { o[h] = String(r[i] || '').trim(); });
    return o;
  });
}

/** First matching column, so a renamed header degrades instead of blanking. */
const col = (row, ...names) => {
  for (const n of names) {
    const v = row[n.toLowerCase()];
    if (v) return v;
  }
  return '';
};

/** A description blob becomes one line per bullet, without the glyphs. */
function toBullets(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => clean(l).replace(BULLET_START, ''))
    .filter(Boolean)
    .join('\n');
}

// LinkedIn's proficiency wording is not the app's, and an unmatched value would
// leave the select showing the wrong level.
function toLevel(raw) {
  const s = String(raw || '').toLowerCase();
  if (/native|bilingual/.test(s)) return 'Native';
  if (/full professional|professional working/.test(s)) return 'Fluent';
  if (/limited working/.test(s)) return 'Intermediate';
  if (/elementary/.test(s)) return 'Basic';
  return 'Fluent';
}

export function parseLinkedInArchive(csvs, base) {
  const data = base ? JSON.parse(JSON.stringify(base)) : blankData();
  const found = [];
  const notes = [];
  const read = [];
  const get = (stem) => {
    const key = Object.keys(csvs).find((k) => k.slice(0, -4) === stem || k.startsWith(stem));
    if (key) read.push(key);
    return key ? csvs[key] : '';
  };

  const profile = csvRows(get('profile'), ['First Name', 'Headline', 'Summary']);
  if (profile.length) {
    const p = profile[0];
    const name = [col(p, 'First Name'), col(p, 'Last Name')].filter(Boolean).join(' ');
    if (name) data.basics.fullName = name;
    data.basics.headline = col(p, 'Headline') || data.basics.headline;
    data.basics.summary = col(p, 'Summary') || data.basics.summary;
    data.basics.location = col(p, 'Geo Location', 'Location') || data.basics.location;
    const site = col(p, 'Websites');
    if (site) data.basics.website = site.replace(/^\[|\]$/g, '').split(',')[0].replace(/^\w+:/, '');
    if (name) found.push('profile');
  }

  const emails = csvRows(get('email addresses'), ['Email Address']);
  const primary = emails.find((e) => /yes|true/i.test(col(e, 'Primary'))) || emails[0];
  if (primary) data.basics.email = col(primary, 'Email Address') || data.basics.email;

  const phones = csvRows(get('phone numbers'), ['Number']);
  if (phones.length) data.basics.phone = col(phones[0], 'Number') || data.basics.phone;

  const positions = csvRows(get('positions'), ['Company Name', 'Title']);
  positions.forEach((r) => {
    const role = col(r, 'Title');
    const company = col(r, 'Company Name');
    if (!role && !company) return;
    const end = col(r, 'Finished On');
    data.experience.push({
      role,
      company,
      location: col(r, 'Location'),
      start: col(r, 'Started On'),
      end,
      current: !end,
      bullets: toBullets(col(r, 'Description')),
    });
  });
  if (data.experience.length) found.push('experience');

  csvRows(get('education'), ['School Name']).forEach((r) => {
    const school = col(r, 'School Name');
    if (!school) return;
    data.education.push({
      degree: col(r, 'Degree Name'),
      school,
      location: '',
      start: col(r, 'Start Date'),
      end: col(r, 'End Date'),
      score: '',
      details: toBullets(col(r, 'Notes', 'Activities')),
    });
  });
  if (data.education.length) found.push('education');

  const skills = csvRows(get('skills'), ['Name']).map((r) => col(r, 'Name')).filter(Boolean);
  if (skills.length) {
    data.skills.push({ group: 'Skills', items: skills.join(', ') });
    found.push('skills');
    notes.push('LinkedIn exports skills as one flat list, so they arrived as a single group. '
      + 'Splitting them into named groups reads better on a CV.');
  }

  csvRows(get('certifications'), ['Name', 'Authority']).forEach((r) => {
    const name = col(r, 'Name');
    if (!name) return;
    data.certifications.push({
      name,
      issuer: col(r, 'Authority'),
      year: (col(r, 'Started On').match(/(19|20)\d{2}/) || [''])[0],
      link: col(r, 'Url'),
    });
  });
  if (data.certifications.length) found.push('certifications');

  csvRows(get('languages'), ['Name']).forEach((r) => {
    const name = clean(col(r, 'Name'));
    if (name) data.languages.push({ name, level: toLevel(col(r, 'Proficiency')) });
  });
  if (data.languages.length) found.push('languages');

  csvRows(get('projects'), ['Title']).forEach((r) => {
    const name = col(r, 'Title');
    if (!name) return;
    data.projects.push({
      name,
      tech: '',
      link: col(r, 'Url'),
      date: col(r, 'Started On'),
      bullets: toBullets(col(r, 'Description')),
    });
  });
  if (data.projects.length) found.push('projects');

  if (!data.experience.length) {
    notes.push('No positions were found. If Positions.csv is missing, the archive was the '
      + '"Connections only" export rather than the full one.');
  }
  if (data.experience.some((e) => !e.bullets)) {
    notes.push('Some roles have no description - LinkedIn only exports what you filled in there. '
      + 'Those are the ones worth writing first.');
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
      chars: Object.values(csvs).reduce((n, t) => n + t.length, 0),
      source: 'LinkedIn archive',
      read,
    },
  };
}

/* ------------------------------------------------------- the profile PDF */

// LinkedIn's own PDF is unmistakeable: the contact block prints the profile URL
// followed by "(LinkedIn)", and the left rail is headed "Top Skills".
export function looksLikeLinkedIn(text) {
  const t = String(text || '');
  return /linkedin\.com\/in\//i.test(t)
    && (/\(LinkedIn\)/.test(t) || /^\s*Top Skills\s*$/m.test(t) || /Page \d+ of \d+/.test(t));
}

// The rail prints before the main column, so these are read first and removed.
const LI_RAIL = ['Contact', 'Top Skills', 'Languages', 'Certifications',
  'Honors-Awards', 'Publications', 'Interests'];
const LI_MAIN = ['Summary', 'Experience', 'Education', 'Volunteer Experience',
  'Licenses & Certifications', 'Projects'];

const LI_DATE = /^([A-Z][a-z]+ \d{4}|\d{4})\s*[-–—]\s*(Present|[A-Z][a-z]+ \d{4}|\d{4})/;
// "3 years 5 months", "(11 months)" - printed on its own line, sometimes under
// the company and sometimes under the date.
const LI_DURATION = /^\(?\s*\d+\s+(year|month)s?(\s+\d+\s+months?)?\s*\)?$/i;
// "· (July 2017 - July 2021)" - LinkedIn prints education dates on their own
// line, after a degree that may have wrapped over two or three lines.
const LI_EDU_DATE = /^[·•*\s]*\(\s*([A-Za-z]*\s*\d{4})\s*[-–—]\s*([A-Za-z]*\s*\d{4}|Present)\s*\)\s*$/;

const looksLocation = (l) => Boolean(l) && l.length < 60 && l.split(',').length >= 2
  && !/[.;:]$/.test(l) && !LI_DATE.test(l);
// A company name is short and is not a sentence, a duration or a date.
const looksCompany = (l) => Boolean(l) && l.length < 60 && !/[.;:|]$/.test(l)
  && !LI_DURATION.test(l) && !LI_DATE.test(l) && l.split(' ').length < 9;

export function parseLinkedInPdf(text, base) {
  const data = base ? JSON.parse(JSON.stringify(base)) : blankData();
  const notes = [];
  const found = [];

  const lines = String(text)
    .split('\n')
    .map((l) => clean(l))
    // Page furniture. "Page 1 of 2" is laid out as four separate text runs, so
    // it arrives as four lines - and the stray "1" and "of" then land in
    // whichever section the page happened to break in.
    .filter((l) => l && !/^(Page|of|\d{1,3}|Page \d+ of \d+|\d+ of \d+)$/i.test(l));

  const heads = new Set([...LI_RAIL, ...LI_MAIN]);

  // Name, headline and location print with no heading of their own, directly
  // before the first main-column section. Lift them out first, or they get
  // swallowed by whichever rail section happens to precede them.
  // The profile URL carries the person's name, which is the only reliable way
  // to tell where the identity block starts: a headline wraps over any number
  // of lines, and the left rail's last items sit directly above it. Counting
  // lines backwards either clipped the headline or swallowed their skills.
  const urlAt = lines.findIndex((l) => /linkedin\.com\/in\//i.test(l));
  let slugWords = [];
  if (urlAt >= 0) {
    let url = lines[urlAt];
    if (/-$/.test(url) && lines[urlAt + 1]) url += lines[urlAt + 1];
    const slug = (url.match(/\/in\/([^/?\s(]+)/) || [])[1] || '';
    // Drop LinkedIn's disambiguating id, which is sometimes digits
    // ("-074334145") and sometimes alphanumeric ("-1a2b3c"). Only whole
    // alphabetic tokens can be part of a name.
    slugWords = slug.split('-').filter((w) => /^[a-z]{2,}$/i.test(w));
  }
  const isNameLine = (l) => slugWords.length > 0
    && slugWords.every((w) => l.toLowerCase().includes(w));

  const mainAt = lines.findIndex((l) => LI_MAIN.includes(l));
  const identity = [];
  let idFrom = mainAt;
  if (mainAt > 0) {
    for (let i = mainAt - 1; i >= 0 && identity.length < 8; i -= 1) {
      if (heads.has(lines[i])) break;
      identity.unshift(lines[i]);
      idFrom = i;
      if (isNameLine(lines[i])) break;   // the name is the top of the block
    }
    // No usable slug: fall back to a name, a one-line headline and a location.
    if (!slugWords.length && identity.length > 3) {
      identity.splice(0, identity.length - 3);
      idFrom = mainAt - 3;
    }
  }

  const rest = mainAt > 0
    ? lines.filter((_, i) => i < idFrom || i >= mainAt)
    : lines;

  const blocks = [];
  let current = { id: '', lines: [] };
  for (const line of rest) {
    if (heads.has(line)) {
      if (current.id || current.lines.length) blocks.push(current);
      current = { id: line, lines: [] };
    } else current.lines.push(line);
  }
  blocks.push(current);

  const grab = (id) => (blocks.find((b) => b.id === id) || { lines: [] }).lines;

  /* contact rail. The profile URL is long enough that LinkedIn wraps it, so a
     line ending in a hyphen continues on the next one. */
  const contact = [];
  for (const l of grab('Contact')) {
    if (contact.length && /-$/.test(contact[contact.length - 1])
      && /linkedin\.com/i.test(contact[contact.length - 1])) {
      contact[contact.length - 1] += l;
    } else contact.push(l);
  }
  for (const l of contact) {
    if (/@/.test(l) && !/linkedin\.com/i.test(l) && !data.basics.email) {
      data.basics.email = l.replace(/\s*\(.*\)$/, '');
    } else if (/linkedin\.com\/in\//i.test(l) && !data.basics.linkedin) {
      data.basics.linkedin = l.replace(/\s*\(LinkedIn\)\s*$/i, '');
    } else if (/^[+(\d][\d\s()+-]{7,}$/.test(l) && !data.basics.phone) {
      data.basics.phone = l.replace(/\s*\(.*\)$/, '');
    }
  }

  const skills = grab('Top Skills').filter((l) => l.length < 60);
  if (skills.length) {
    data.skills.push({ group: 'Skills', items: skills.join(', ') });
    found.push('skills');
  }

  grab('Languages').forEach((l) => {
    const m = l.match(/^(.+?)\s*\((.+)\)$/);
    data.languages.push({ name: clean(m ? m[1] : l), level: toLevel(m ? m[2] : '') });
  });
  if (data.languages.length) found.push('languages');

  grab('Certifications').forEach((l) => {
    data.certifications.push({ name: l, issuer: '', year: '', link: '' });
  });
  if (data.certifications.length) found.push('certifications');

  grab('Honors-Awards').forEach((l) => data.achievements.push({ text: l }));
  if (data.achievements.length) found.push('achievements');

  if (identity.length) {
    data.basics.fullName = identity[0];
    const middle = identity.slice(1);
    // The last line is the location when it reads like one; the rest is the
    // headline, rejoined because LinkedIn wraps it mid-sentence.
    if (middle.length && looksLocation(middle[middle.length - 1])) {
      data.basics.location = middle.pop();
    }
    if (middle.length) data.basics.headline = middle.join(' ');
    found.push('profile');
  }

  const summary = grab('Summary');
  if (summary.length) { data.basics.summary = summary.join('\n'); found.push('summary'); }

  /* experience
   *
   * LinkedIn prints one of two shapes, and a real profile mixes them:
   *
   *   Deloitte                     <- one role at this company
   *   Consultant
   *   November 2024 - Present
   *   (1 year 10 months)           <- the duration wraps to its own line
   *   Hyderabad, Telangana, India
   *
   *   Cognizant                    <- several roles at this company
   *   3 years 5 months
   *   Software Engineer
   *   January 2024 - November 2024
   *   ...
   *   Junior Software Engineer     <- company named only once, above
   *   July 2021 - January 2024
   */
  const exp = grab('Experience');
  const dateAt = exp.map((l, i) => (LI_DATE.test(l) ? i : -1)).filter((i) => i >= 0);

  // "Java 8 | Rest Web Service | MySQL |" wraps onto the next line, and that
  // orphan looked exactly like a company name sitting above the next title.
  const continues = (l) => Boolean(l) && /[|,;–—-]$/.test(l);

  // Is the line at `i` a company header, rather than the tail of the previous
  // role's description?
  const isCompanyAt = (i) => i >= 0 && looksCompany(exp[i]) && !continues(exp[i - 1]);

  // Where the header block for the role anchored at date index `d` begins.
  const headerStart = (d) => {
    let s = d - 1;                                        // the title
    if (s - 1 >= 0 && LI_DURATION.test(exp[s - 1])) s -= 2;   // company + duration
    else if (isCompanyAt(s - 1)) s -= 1;                      // company
    return Math.max(0, s);
  };

  let lastCompany = '';
  dateAt.forEach((d, n) => {
    const [, start, end] = exp[d].match(LI_DATE);
    const role = exp[d - 1] || '';

    let company = '';
    if (LI_DURATION.test(exp[d - 2] || '')) company = exp[d - 3] || '';
    else if (isCompanyAt(d - 2)) company = exp[d - 2];
    // A later role under the same company lists no company of its own.
    if (!company || !looksCompany(company)) company = lastCompany;
    if (company) lastCompany = company;

    let j = d + 1;
    if (LI_DURATION.test(exp[j] || '')) j += 1;       // "(1 year 10 months)"
    let location = '';
    if (looksLocation(exp[j] || '')) { location = exp[j]; j += 1; }

    const stop = n + 1 < dateAt.length ? headerStart(dateAt[n + 1]) : exp.length;
    const bullets = exp.slice(j, Math.max(j, stop))
      .filter((l) => !LI_DURATION.test(l))
      .map((l) => l.replace(BULLET_START, ''));

    data.experience.push({
      role,
      company,
      location,
      start,
      end: /present/i.test(end) ? '' : end,
      current: /present/i.test(end),
      bullets: bullets.join('\n'),
    });
  });
  if (data.experience.length) found.push('experience');

  /* education
   *
   *   Techno Main - Salt Lake                     <- school
   *   Bachelor of Technology - BTech, Electronics <- the degree wraps
   *   and Communication Engineering
   *   · (July 2017 - July 2021)                   <- dates on their own line
   *
   * So each date line closes an entry, and everything since the previous one
   * is [school, ...degree].
   */
  const edu = grab('Education');
  let chunk = [];
  const seenEdu = new Set();
  for (const line of edu) {
    const m = line.match(LI_EDU_DATE);
    if (!m) { chunk.push(line); continue; }
    if (chunk.length) {
      const school = chunk[0];
      const degree = clean(chunk.slice(1).join(' '));
      const key = school + '|' + degree;
      // LinkedIn's PDF repeats an entry when it spans a page break.
      if (!seenEdu.has(key)) {
        seenEdu.add(key);
        data.education.push({
          degree,
          school,
          location: '',
          start: clean(m[1]),
          end: /present/i.test(m[2]) ? '' : clean(m[2]),
          score: '',
          details: '',
        });
      }
    }
    chunk = [];
  }
  if (data.education.length) found.push('education');

  if (!data.experience.length) {
    notes.push('No roles were recognised in this PDF. It may be an older LinkedIn layout - '
      + 'paste the text instead, or use the data archive route.');
  }
  notes.push('Read as a LinkedIn profile export. LinkedIn writes in the first person and its '
    + 'own house style, so expect the check to flag plenty. That is the point of it.');

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
      source: 'LinkedIn PDF',
    },
  };
}
