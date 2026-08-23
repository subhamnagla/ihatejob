// Builds the whole editor panel as a string from SECTIONS + settings.
// Open/closed state lives here so a re-render does not collapse the panel.

import {
  SECTIONS, SECTION_IDS, BASICS_FIELDS, OPTIONAL_SECTIONS, COVER_FIELDS,
} from './schema.js';
import { TEMPLATES, esc } from './templates.js';
import {
  PROFESSION_GROUPS, REGIONS, professionOf, regionOf, pageTarget, sectionVisible,
} from './professions.js';

const open = new Set(['role', 'design', 'basics', 'summary', 'experience']);

export function isOpen(key) { return open.has(key); }
export function toggleOpen(key) {
  if (open.has(key)) open.delete(key); else open.add(key);
}
export function setOpen(key, on) {
  if (on) open.add(key); else open.delete(key);
}

const ACCENTS = ['#2563eb', '#0f766e', '#b91c1c', '#7c3aed', '#c2410c', '#0e7490', '#4d7c0f', '#111827'];

const FONTS = [
  ['sans', 'Sans'],
  ['serif', 'Georgia'],
  ['helvetica', 'Helvetica'],
  ['book', 'Palatino'],
];

/* ------------------------------------------------------------- controls */

function spanClass(n) {
  if (n === 6) return ' s6';
  if (n === 4) return ' s4';
  return '';
}

function field(f, path, value, item) {
  const cls = 'field' + spanClass(f.span);
  const label = esc(f.label);
  const ph = esc(f.placeholder || '');
  const p = esc(path);

  if (f.type === 'check') {
    return '<div class="' + cls + '"><label class="check">'
      + '<input type="checkbox" data-path="' + p + '"' + (value ? ' checked' : '') + '>'
      + '<span>' + label + '</span></label></div>';
  }

  if (f.type === 'select') {
    const opts = f.options.map((o) => (
      '<option value="' + esc(o) + '"' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>'
    )).join('');
    return '<div class="' + cls + '"><label for="' + p + '">' + label + '</label>'
      + '<select class="select" id="' + p + '" data-path="' + p + '">' + opts + '</select></div>';
  }

  if (f.type === 'area' || f.type === 'lines') {
    return '<div class="' + cls + '"><label for="' + p + '">' + label + '</label>'
      + '<textarea class="input" id="' + p + '" rows="' + (f.rows || 3) + '" data-path="' + p + '"'
      + ' placeholder="' + ph + '">' + esc(value || '') + '</textarea></div>';
  }

  const disabled = f.disabledBy && item && item[f.disabledBy] ? ' disabled' : '';
  return '<div class="' + cls + '"><label for="' + p + '">' + label + '</label>'
    + '<input class="input" id="' + p + '" type="text" data-path="' + p + '"'
    + ' value="' + esc(value || '') + '" placeholder="' + ph + '"' + disabled + '></div>';
}

function acc(key, title, count, body, flag) {
  const isOn = open.has(key);
  return '<div class="acc' + (isOn ? ' open' : '') + '" data-acc="' + esc(key) + '">'
    + '<button class="acc-head" type="button" data-act="acc" data-key="' + esc(key) + '"'
    + ' aria-expanded="' + isOn + '">'
    + '<span class="acc-chev">&#9656;</span>'
    + '<span class="acc-title">' + esc(title) + '</span>'
    + (flag ? '<span class="acc-flag" title="Expected for this profession">needed</span>' : '')
    + (count != null ? '<span class="acc-count">' + count + '</span>' : '')
    + '</button>'
    + '<div class="acc-body">' + body + '</div>'
    + '</div>';
}

function tools(sec, i, last) {
  const b = (act, dir, label, glyph, off) =>
    '<button class="btn btn-sm btn-icon' + (act === 'del' ? ' btn-danger' : '') + '" type="button"'
    + ' data-act="' + act + '" data-sec="' + sec + '" data-i="' + i + '"'
    + (dir ? ' data-dir="' + dir + '"' : '')
    + ' title="' + label + '" aria-label="' + label + '"' + (off ? ' disabled' : '') + '>' + glyph + '</button>';

  return '<span class="item-tools">'
    + b('move', '-1', 'Move up', '&#9650;', i === 0)
    + b('move', '1', 'Move down', '&#9660;', i === last)
    + b('dup', '', 'Duplicate', '&#10697;', false)
    + b('del', '', 'Remove', '&#10005;', false)
    + '</span>';
}

/* --------------------------------------------------------- list section */

function listSection(id, data) {
  const def = SECTIONS[id];
  const items = data[id] || [];
  const prof = professionOf(data.settings);
  const guide = prof.guidance && prof.guidance[id];
  const title = (data.settings.labels && data.settings.labels[id]) || def.title;
  const required = (prof.require || []).includes(id);

  const body = items.map((it, i) => {
    const key = 'item:' + id + ':' + i;
    const fields = def.fields
      .map((f) => field(f, id + '.' + i + '.' + f.k, it[f.k], it))
      .join('');
    const sub = def.sub ? def.sub(it) : '';

    return '<div class="item' + (open.has(key) ? ' open' : '') + '">'
      + '<div class="item-head">'
      + '<button class="item-grip" type="button" data-act="item" data-key="' + esc(key) + '">'
      + '<div class="item-name">' + esc(def.label(it)) + '</div>'
      + (sub ? '<div class="item-sub">' + esc(sub) + '</div>' : '')
      + '</button>'
      + tools(id, i, items.length - 1)
      + '</div>'
      + '<div class="item-body"><div class="grid">' + fields + '</div></div>'
      + '</div>';
  }).join('');

  const empty = items.length ? '' : '<div class="empty">'
    + (required
      ? 'A ' + esc(prof.name) + ' CV is expected to have this. It stays off the page until you add something.'
      : 'Nothing here yet. This section is hidden from the CV until you add something.')
    + '</div>';

  const add = '<div class="add-row"><button class="btn btn-sm" type="button" data-act="add" data-sec="'
    + id + '">+ ' + esc(def.addLabel) + '</button></div>';

  const hint = guide ? '<div class="hint guide">' + esc(guide) + '</div>' : '';

  return acc(id, title, items.length, hint + empty + body + add, required && !items.length);
}

/* ------------------------------------------------------------ thumbnails */

const THUMBS = {
  classic: [[6, 26, 48, 8, 'd'], [17, 34, 32, 3, 'l'], [27, 12, 76, 2, 'a'],
    [32, 12, 70, 3, 'l'], [37, 12, 62, 3, 'l'], [46, 12, 76, 2, 'a'],
    [51, 12, 72, 3, 'l'], [56, 12, 58, 3, 'l'], [65, 12, 76, 2, 'a'],
    [70, 12, 68, 3, 'l'], [75, 12, 52, 3, 'l']],
  minimal: [[9, 10, 40, 7, 'd'], [19, 10, 26, 3, 'l'], [31, 10, 16, 2, 'l'],
    [37, 10, 74, 3, 'l'], [42, 10, 64, 3, 'l'], [53, 10, 18, 2, 'l'],
    [59, 10, 72, 3, 'l'], [64, 10, 56, 3, 'l'], [75, 10, 14, 2, 'l'],
    [81, 10, 66, 3, 'l']],
  ats: [[6, 10, 44, 6, 'd'], [15, 10, 64, 3, 'l'], [24, 10, 80, 2, 'd'],
    [29, 10, 76, 3, 'l'], [34, 10, 70, 3, 'l'], [39, 10, 74, 3, 'l'],
    [48, 10, 80, 2, 'd'], [53, 10, 72, 3, 'l'], [58, 10, 66, 3, 'l'],
    [63, 10, 70, 3, 'l'], [72, 10, 80, 2, 'd'], [77, 10, 68, 3, 'l'],
    [82, 10, 58, 3, 'l']],
  executive: [[8, 10, 52, 8, 'd'], [19, 10, 30, 3, 'l'], [27, 10, 80, 1.6, 'd'],
    [34, 10, 20, 3, 'a'], [34, 36, 54, 3, 'l'], [39, 36, 46, 3, 'l'],
    [50, 10, 20, 3, 'a'], [50, 36, 54, 3, 'l'], [55, 36, 42, 3, 'l'],
    [66, 10, 20, 3, 'a'], [66, 36, 50, 3, 'l'], [71, 36, 44, 3, 'l']],
  modern: [[0, 0, 34, 100, 'a'], [10, 6, 22, 5, 'w'], [19, 6, 16, 2.5, 'w'],
    [30, 6, 20, 2.5, 'w'], [36, 6, 14, 2.5, 'w'], [47, 6, 20, 2.5, 'w'],
    [53, 6, 16, 2.5, 'w'],
    [10, 42, 44, 7, 'd'], [21, 42, 30, 3, 'l'], [32, 42, 14, 2, 'a'],
    [37, 42, 50, 3, 'l'], [42, 42, 44, 3, 'l'], [53, 42, 14, 2, 'a'],
    [58, 42, 48, 3, 'l'], [63, 42, 40, 3, 'l'], [74, 42, 14, 2, 'a'],
    [79, 42, 46, 3, 'l']],
  academic: [[8, 10, 44, 7, 'd'], [18, 10, 30, 3, 'l'], [27, 10, 80, 1.2, 'd'],
    [33, 10, 18, 2, 'l'], [38, 10, 72, 2.5, 'l'], [42, 10, 64, 2.5, 'l'],
    [50, 10, 20, 2, 'l'], [55, 10, 76, 2.5, 'l'], [59, 10, 70, 2.5, 'l'],
    [63, 10, 73, 2.5, 'l'], [67, 10, 66, 2.5, 'l'],
    [75, 10, 16, 2, 'l'], [80, 10, 74, 2.5, 'l'], [84, 10, 68, 2.5, 'l']],
  federal: [[6, 8, 84, 14, 'l'], [10, 12, 36, 5, 'd'],
    [25, 8, 84, 4, 't'], [25, 8, 2, 4, 'a'],
    [31, 10, 70, 2.5, 'l'], [35, 10, 62, 2.5, 'l'],
    [42, 8, 84, 4, 't'], [42, 8, 2, 4, 'a'],
    [48, 10, 72, 2.5, 'l'], [52, 10, 64, 2.5, 'l'], [56, 10, 68, 2.5, 'l'],
    [63, 8, 84, 4, 't'], [63, 8, 2, 4, 'a'],
    [69, 10, 70, 2.5, 'l'], [73, 10, 60, 2.5, 'l'], [77, 10, 66, 2.5, 'l']],
  creative: [[0, 0, 100, 22, 'a'], [7, 8, 42, 6, 'w'], [16, 8, 26, 3, 'w'],
    [22, 64, 36, 78, 't'],
    [31, 8, 14, 2, 'a'], [36, 8, 46, 3, 'l'], [41, 8, 40, 3, 'l'],
    [52, 8, 14, 2, 'a'], [57, 8, 44, 3, 'l'], [62, 8, 36, 3, 'l'],
    [73, 8, 14, 2, 'a'], [78, 8, 42, 3, 'l'],
    [28, 68, 22, 2.5, 'a'], [34, 68, 26, 2.5, 'l'], [39, 68, 20, 2.5, 'l'],
    [49, 68, 22, 2.5, 'a'], [55, 68, 26, 2.5, 'l'], [60, 68, 18, 2.5, 'l']],
};

function thumb(key, accent) {
  const paint = {
    d: '#3d4753',
    l: '#ccd3dc',
    a: accent,
    w: 'rgba(255,255,255,.85)',
    t: 'color-mix(in srgb, ' + accent + ' 14%, #fff)',
  };
  const rects = (THUMBS[key] || []).map(([t, l, w, h, k]) => (
    '<i style="top:' + t + '%;left:' + l + '%;width:' + w + '%;height:' + h + '%;background:' + paint[k] + '"></i>'
  )).join('');
  return '<div class="thumb">' + rects + '</div>';
}

/* -------------------------------------------------- profession & region */

function roleSection(d) {
  const s = d.settings;
  const prof = professionOf(s);
  const region = regionOf(s);
  const [minP, maxP] = pageTarget(s);

  const profOptions = PROFESSION_GROUPS.map((g) => (
    '<optgroup label="' + esc(g.name) + '">'
    + g.items.map((p) => '<option value="' + esc(p.id) + '"'
      + (s.profession === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('')
    + '</optgroup>'
  )).join('');

  const regionOptions = Object.entries(REGIONS).map(([id, r]) => (
    '<option value="' + esc(id) + '"' + (s.region === id ? ' selected' : '') + '>'
    + esc(r.name) + '</option>'
  )).join('');

  const optional = OPTIONAL_SECTIONS.map((id) => (
    '<label class="check"><input type="checkbox" data-act="toggle-section" data-sec="' + id + '"'
    + (sectionVisible(d, id) ? ' checked' : '')
    + ((d[id] || []).length ? ' disabled title="In use - delete its entries to hide it"' : '')
    + '><span>' + esc(SECTIONS[id].title) + '</span></label>'
  )).join('');

  const body = '<div class="hint">Picking a profession sets the layout, the section order and the '
    + 'section names to that field\'s convention. Everything stays editable afterwards.</div>'
    + '<div class="grid">'
    + '<div class="field s6"><label for="profSel">Profession</label>'
    + '<select class="select" id="profSel" data-act="profession">' + profOptions + '</select></div>'
    + '<div class="field s6"><label for="regionSel">Applying in</label>'
    + '<select class="select" id="regionSel" data-act="region">' + regionOptions + '</select></div>'
    + '</div>'
    + '<div class="callout"><b>' + esc(region.name) + '</b> ' + esc(region.note) + '</div>'
    + '<div class="callout"><b>Target length</b> '
    + esc(minP === maxP ? minP + ' page' : minP + ' to ' + maxP + ' pages')
    + ' for ' + esc(prof.name.toLowerCase()) + '.'
    + (prof.metrics ? ' Numbers that count here: ' + esc(prof.metrics.slice(0, 5).join(', ')) + '.' : '')
    + '</div>'
    + '<div class="sample-row">'
    + '<button class="btn btn-sm" type="button" data-act="see-sample">See a sample '
    + esc(prof.name) + ' CV</button>'
    + '<span class="hint" style="margin:0">Opens a worked example. Your own CV is not touched.</span>'
    + '</div>'
    + '<div class="hint">Extra sections</div><div class="checks">' + optional + '</div>';

  return acc('role', 'Profession & region', null, body);
}

/* ------------------------------------------------------------ design tab */

function designSection(d) {
  const s = d.settings;

  const gallery = '<div class="tpl-grid">' + Object.entries(TEMPLATES).map(([k, t]) => (
    '<button class="tpl-card' + (s.template === k ? ' sel' : '') + '" type="button"'
    + ' data-act="set" data-path="settings.template" data-value="' + k + '">'
    + thumb(k, s.accent)
    + '<b>' + esc(t.name) + '</b><span>' + esc(t.blurb) + '</span>'
    + '</button>'
  )).join('') + '</div>';

  const swatches = '<div class="swatches">'
    + ACCENTS.map((c) => (
      '<button class="swatch' + (s.accent.toLowerCase() === c ? ' sel' : '') + '" type="button"'
      + ' style="background:' + c + '" data-act="set" data-path="settings.accent" data-value="' + c + '"'
      + ' title="' + c + '" aria-label="Accent ' + c + '"></button>'
    )).join('')
    + '<input type="color" class="swatch-custom" value="' + esc(s.accent) + '" data-path="settings.accent"'
    + ' title="Custom colour" aria-label="Custom accent colour">'
    + '</div>';

  const seg = (path, opts, cur) => '<div class="seg">' + opts.map(([v, lab]) => (
    '<button type="button" class="' + (cur === v ? 'sel' : '') + '"'
    + ' data-act="set" data-path="' + path + '" data-value="' + v + '">' + esc(lab) + '</button>'
  )).join('') + '</div>';

  const photo = '<div class="photo-row">'
    + (d.basics.photo
      ? '<img class="photo-prev" src="' + esc(d.basics.photo) + '" alt="">'
      : '<div class="photo-prev"></div>')
    + '<div>'
    + '<button class="btn btn-sm" type="button" data-act="photo">'
    + (d.basics.photo ? 'Replace photo' : 'Upload photo') + '</button> '
    + (d.basics.photo ? '<button class="btn btn-sm btn-danger" type="button" data-act="photo-clear">Remove</button>' : '')
    + '<div class="hint" style="margin-top:6px">Optional. Ignored by the ATS Plain format.</div>'
    + '</div></div>';

  const body = '<div class="hint">Format</div>' + gallery
    + '<div class="hint">Accent colour</div>' + swatches
    + '<div class="hint">Typeface</div>' + seg('settings.font', FONTS, s.font)
    + '<div class="hint">Text size</div>'
    + '<div class="range-row"><input type="range" min="85" max="118" step="1" value="' + s.scale + '"'
    + ' data-path="settings.scale" aria-label="Text size"><output>' + s.scale + '%</output></div>'
    + '<div class="hint">Spacing</div>'
    + seg('settings.density', [['compact', 'Compact'], ['normal', 'Normal'], ['roomy', 'Roomy']], s.density)
    + '<div class="hint">Paper</div>'
    + seg('settings.paper', [['a4', 'A4'], ['letter', 'US Letter']], s.paper)
    + '<div class="grid"><div class="field"><label class="check">'
    + '<input type="checkbox" data-path="settings.uppercaseHeadings"' + (s.uppercaseHeadings ? ' checked' : '') + '>'
    + '<span>Uppercase section headings</span></label></div>'
    + '<div class="field"><label class="check">'
    + '<input type="checkbox" data-path="settings.showPhoto"' + (s.showPhoto ? ' checked' : '') + '>'
    + '<span>Show photo (when one is uploaded)</span></label></div></div>'
    + '<div class="hint">Photo</div>' + photo;

  return acc('design', 'Format & design', null, body);
}

function orderSection(d) {
  const names = Object.fromEntries(SECTION_IDS.map((id) => [
    id, (d.settings.labels && d.settings.labels[id]) || SECTIONS[id].title,
  ]));
  // Hidden sections stay in settings.order but must not be shown or stepped
  // over, so each row carries the real index of its visible neighbour to swap
  // with rather than a blind +1 / -1.
  const visible = d.settings.order
    .map((id, i) => ({ id, i }))
    .filter(({ id }) => sectionVisible(d, id));

  const list = visible.map(({ id, i }, pos) => (
    '<li><span>' + esc(names[id] || id) + '</span>'
    + '<button class="btn btn-sm btn-icon" type="button" data-act="order" data-i="' + i + '"'
    + ' data-swap="' + (pos > 0 ? visible[pos - 1].i : '') + '"'
    + ' aria-label="Move up"' + (pos === 0 ? ' disabled' : '') + '>&#9650;</button>'
    + '<button class="btn btn-sm btn-icon" type="button" data-act="order" data-i="' + i + '"'
    + ' data-swap="' + (pos < visible.length - 1 ? visible[pos + 1].i : '') + '"'
    + ' aria-label="Move down"' + (pos === visible.length - 1 ? ' disabled' : '') + '>&#9660;</button>'
    + '</li>'
  )).join('');

  return acc('order', 'Section order', null,
    '<div class="hint">Empty sections are skipped automatically. Sidebar formats pull skills, '
    + 'languages and certifications into the side column.</div>'
    + '<ul class="order-list">' + list + '</ul>');
}

/* --------------------------------------------------------- cover letter */

function coverSection(d) {
  const c = d.cover || {};
  const filled = Boolean(String(c.body || '').trim());
  const brackets = (String(c.body || '').match(/\[[^\]]+\]/g) || []).length;

  const fields = '<div class="grid">'
    + COVER_FIELDS.map((f) => field(f, 'cover.' + f.k, c[f.k])).join('')
    + '</div>';

  const warn = brackets
    ? '<div class="hint guide">' + brackets + ' bracketed prompt'
      + (brackets === 1 ? '' : 's') + ' still to replace. Anything left in [square brackets] '
      + 'will print exactly as it appears.</div>'
    : '';

  const start = '<div class="sample-row">'
    + '<button class="btn btn-sm" type="button" data-act="cover-scaffold">'
    + (filled ? 'Replace with the structure' : 'Start from a structure') + '</button>'
    + '<span class="hint" style="margin:0">Gives you the four paragraphs to fill in. '
    + 'It writes no claims for you.</span></div>';

  return acc('cover', 'Cover letter', filled ? null : undefined,
    '<div class="hint">A separate page, using the same name block, typeface and accent as your CV. '
    + 'Switch to it with the <b>Letter</b> tab above the preview.</div>'
    + warn + fields + start);
}

/* ------------------------------------------------------------------ panel */

export function buildPanel(d) {
  const basics = '<div class="grid">'
    + BASICS_FIELDS.map((f) => field(f, 'basics.' + f.k, d.basics[f.k])).join('')
    + '</div>';

  const summary = '<div class="hint">' + esc(SECTIONS.summary.hint) + '</div>'
    + '<div class="grid">'
    + field({ k: 'summary', label: 'Summary', type: 'area', span: 12, rows: 5,
      placeholder: 'Frontend engineer with six years building customer-facing products...' },
    'basics.summary', d.basics.summary)
    + '</div>';

  const lists = SECTION_IDS
    .filter((id) => !SECTIONS[id].single && sectionVisible(d, id))
    .map((id) => listSection(id, d))
    .join('');

  const summaryTitle = (d.settings.labels && d.settings.labels.summary) || SECTIONS.summary.title;

  return roleSection(d)
    + designSection(d)
    + acc('basics', 'Personal details', null, basics)
    + acc('summary', summaryTitle, null, summary)
    + lists
    + coverSection(d)
    + orderSection(d);
}
