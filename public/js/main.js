// App controller: state, event wiring, live preview, storage and exports.

import { SECTIONS, blankData, sampleData, coverScaffold } from './schema.js';
import { buildPanel, setOpen, toggleOpen } from './form.js';
import {
  renderCV, renderText, renderLetterDoc, renderLetterText, esc,
} from './templates.js';
import {
  applyProfession, applyRegion, professionOf, PROFESSIONS,
} from './professions.js';
import { reviewCV, checkPhrases } from './review.js';
import { fileToText, parseCV, parseLinkedInArchive, parseSection, parseIdentity,
  recheck, ImportError } from './import.js';
import { buildSample } from './samples.js';
import { PLANETS, planetFor, starsFor, starRow, planetSVG } from './planets.js';
import { availableFixes, applyFixes } from './fixes.js';
import { initPWA } from './pwa.js';
import { matchJD } from './jdmatch.js';

const STORE_KEY = 'ihatejob.v1';
const LEGACY_KEY = 'cvmaker.v1'; // read once so the rename does not lose anyone's CV
const THEME_KEY = 'ihatejob.theme';
const PAPER_MM = { a4: [210, 297], letter: [216, 279] };

const $ = (id) => document.getElementById(id);
const panel = $('panel');
const cvPage = $('cvPage');
const guides = $('pageGuides');
const scaler = $('pageScaler');
const stageScroll = $('stageScroll');

let state = load() || sampleData();
let zoom = 1;
let previewTimer = 0;
let saveTimer = 0;
let pageCount = 1;

/* -------------------------------------------------------------- storage */

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY) || localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

// Fill in anything a stored or imported file is missing so one bad key
// cannot break the whole editor.
function migrate(input) {
  const base = blankData();
  if (!input || typeof input !== 'object') return base;

  base.basics = { ...base.basics, ...(input.basics || {}) };
  for (const k of Object.keys(SECTIONS)) {
    if (SECTIONS[k].single) continue;
    if (Array.isArray(input[k])) base[k] = input[k].map((it) => ({ ...SECTIONS[k].blank(), ...it }));
  }
  base.cover = { ...base.cover, ...(input.cover || {}) };
  base.settings = { ...base.settings, ...(input.settings || {}) };
  base.settings.labels = { ...(input.settings && input.settings.labels) };
  base.settings.shown = { ...(input.settings && input.settings.shown) };

  // Keep the saved order, but drop unknown ids and append any section the
  // file predates, so an old backup never loses a section.
  const defaults = blankData().settings.order;
  const saved = Array.isArray(input.settings && input.settings.order) ? input.settings.order : defaults;
  const seen = new Set();
  const order = [];
  for (const id of saved) {
    if (SECTIONS[id] && !seen.has(id)) { seen.add(id); order.push(id); }
  }
  for (const id of defaults) if (!seen.has(id)) order.push(id);
  base.settings.order = order;
  return base;
}

function scheduleSave() {
  $('saveState').textContent = 'Saving...';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      $('saveState').textContent = 'Saved';
      $('saveState').classList.remove('warn');
    } catch {
      $('saveState').textContent = 'Not saved';
      $('saveState').classList.add('warn');
    }
  }, 350);
}

/* ----------------------------------------------------------- path access */

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (cur == null) return;
    cur = cur[parts[i]];
  }
  if (cur) cur[parts[parts.length - 1]] = value;
}

/* -------------------------------------------------------------- rendering */

function renderPanel() {
  const top = panel.scrollTop;
  panel.innerHTML = buildPanel(state);
  panel.scrollTop = top;
}

// The document currently on screen: a sample when one is open, otherwise the
// user's own CV. Preview, page count and the rating all follow this.
function current() {
  return sampleData_ || state;
}

function renderPreview() {
  const doc = current();
  const { html, classes } = stagePane === 'letter' ? renderLetterDoc(doc) : renderCV(doc);
  cvPage.className = classes;
  cvPage.innerHTML = html;
  cvPage.style.setProperty('--accent', doc.settings.accent);
  cvPage.style.setProperty('--scale', String(doc.settings.scale / 100));

  const [, h] = PAPER_MM[doc.settings.paper] || PAPER_MM.a4;
  guides.style.setProperty('--page-h', h + 'mm');
  $('pageSizeStyle').textContent = '@page { size: ' + (doc.settings.paper === 'a4' ? 'A4' : 'Letter') + '; margin: 0; }';
  updatePageInfo();
  renderReview(); // keeps the Check badge live even while the preview is showing
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 110);
  scheduleSave();
}

let pxPerMm = 3.78;
function measureMm() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;width:100mm;height:0';
  document.body.appendChild(probe);
  pxPerMm = probe.offsetWidth / 100 || 3.78;
  probe.remove();
}

function updatePageInfo() {
  const [, hMm] = PAPER_MM[current().settings.paper] || PAPER_MM.a4;
  measureMm();
  const height = cvPage.getBoundingClientRect().height / zoom;
  // While the preview is hidden (mobile "Edit" tab, or a collapsed pane) the
  // page has no box to measure, so leave the last known count alone.
  if (height < 10) return;

  const pages = Math.max(1, Math.ceil(height / (hMm * pxPerMm) - 0.015));
  pageCount = pages;
  const info = $('pageInfo');
  info.textContent = pages + (pages === 1 ? ' page' : ' pages');
  info.title = pages > 1
    ? 'The red line in the preview marks where each page ends.'
    : 'Fits on a single page.';
  guides.style.display = pages > 1 ? '' : 'none';

  // A printed page break cannot carry a coloured column onto the next sheet,
  // so say so rather than let the PDF surprise them.
  const sidebar = ['modern', 'creative'].includes(current().settings.template);
  const warn = $('pageWarn');
  warn.hidden = !(pages > 1 && sidebar);
  warn.title = 'Page 2 will print without the coloured side column. Trim to one page, '
    + 'or switch to Classic, Minimal, ATS Plain or Executive for longer CVs.';
}

/* ------------------------------------------------------------------ zoom */

let userZoomed = false;

function setZoom(z) {
  zoom = Math.min(1.6, Math.max(0.35, z));
  scaler.style.setProperty('--zoom', String(zoom));
  $('zoomLabel').textContent = Math.round(zoom * 100) + '%';
}

function fitZoom() {
  const [w] = PAPER_MM[current().settings.paper] || PAPER_MM.a4;
  // Read the padding rather than assuming it: the stage is padded 22px on a
  // desktop and 12px on a phone, and a fixed allowance wasted a tenth of the
  // width on the screen that can least spare it.
  const cs = getComputedStyle(stageScroll);
  const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const avail = stageScroll.clientWidth - pad - 2;
  if (avail < 80) return; // pane not laid out yet; the observer retries
  setZoom(Math.min(1, avail / (w * pxPerMm)));
}

/* ----------------------------------------------------------- item headers */

function refreshItemHeader(sec, index, itemEl) {
  const def = SECTIONS[sec];
  const item = state[sec] && state[sec][index];
  if (!def || !item || !itemEl) return;
  const nameEl = itemEl.querySelector('.item-name');
  const subEl = itemEl.querySelector('.item-sub');
  if (nameEl) nameEl.textContent = def.label(item);
  if (subEl && def.sub) subEl.textContent = def.sub(item);
}

/* ---------------------------------------------------------------- toast */

let toastTimer = 0;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}

/* --------------------------------------------------------------- inputs */

panel.addEventListener('input', (e) => {
  const el = e.target.closest('[data-path]');
  if (!el) return;

  const path = el.dataset.path;
  let value;
  if (el.type === 'checkbox') value = el.checked;
  else if (el.type === 'range') value = Number(el.value);
  else value = el.value;

  setPath(state, path, value);

  if (el.type === 'range') {
    const out = el.parentElement.querySelector('output');
    if (out) out.textContent = value + '%';
  }

  const parts = path.split('.');
  if (parts.length === 3 && SECTIONS[parts[0]]) {
    // "current" toggles whether the end-date field is usable
    if (parts[2] === 'current') {
      const end = panel.querySelector('[data-path="' + parts[0] + '.' + parts[1] + '.end"]');
      if (end) end.disabled = value === true;
    }
    refreshItemHeader(parts[0], Number(parts[1]), el.closest('.item'));
  }

  schedulePreview();
});

panel.addEventListener('change', (e) => {
  const acted = e.target.closest('[data-act]');
  if (acted) {
    const act = acted.dataset.act;

    if (act === 'profession') {
      applyProfession(state, acted.value);
      afterStructural();
      const prof = professionOf(state.settings);
      toast('Switched to the ' + prof.name + ' format. Layout, section order and headings updated.');
      return;
    }
    if (act === 'region') {
      const hadPhoto = state.settings.showPhoto && state.basics.photo;
      applyRegion(state, acted.value);
      afterStructural();
      toast(hadPhoto && !state.settings.showPhoto
        ? 'Photo switched off - it is not accepted on CVs for this region.'
        : 'Region set. The Check tab now applies that region\'s rules.');
      return;
    }
    if (act === 'toggle-section') {
      state.settings.shown = state.settings.shown || {};
      state.settings.shown[acted.dataset.sec] = acted.checked;
      afterStructural();
      return;
    }
  }

  // The colour picker fires input continuously; only rebuild the panel (which
  // repaints swatches and thumbnails) once the user settles on a colour.
  if (e.target.closest('input[type="color"]')) {
    renderPanel();
    renderPreview();
  }
});

/* --------------------------------------------------------------- actions */

panel.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;

  if (act === 'acc') {
    toggleOpen(btn.dataset.key);
    btn.closest('.acc').classList.toggle('open');
    btn.setAttribute('aria-expanded', String(btn.closest('.acc').classList.contains('open')));
    return;
  }

  if (act === 'item') {
    toggleOpen(btn.dataset.key);
    btn.closest('.item').classList.toggle('open');
    return;
  }

  if (act === 'set') {
    setPath(state, btn.dataset.path, btn.dataset.value);
    renderPanel();
    renderPreview();
    scheduleSave();
    return;
  }

  const sec = btn.dataset.sec;
  const i = Number(btn.dataset.i);

  if (act === 'add' || act === 'dup') {
    const list = state[sec];
    const item = act === 'dup' ? { ...list[i] } : SECTIONS[sec].blank();
    const at = act === 'dup' ? i + 1 : list.length;
    list.splice(at, 0, item);
    for (let k = 0; k < list.length + 1; k += 1) setOpen('item:' + sec + ':' + k, false);
    setOpen('item:' + sec + ':' + at, true);
    setOpen(sec, true);
    afterStructural();
    return;
  }

  if (act === 'del') {
    state[sec].splice(i, 1);
    for (let k = 0; k < state[sec].length + 2; k += 1) setOpen('item:' + sec + ':' + k, false);
    afterStructural();
    return;
  }

  if (act === 'move') {
    const dir = Number(btn.dataset.dir);
    const list = state[sec];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const openI = 'item:' + sec + ':' + i;
    const openJ = 'item:' + sec + ':' + j;
    const wasI = panel.querySelectorAll('[data-acc="' + sec + '"] .item')[i].classList.contains('open');
    const wasJ = panel.querySelectorAll('[data-acc="' + sec + '"] .item')[j].classList.contains('open');
    setOpen(openI, wasJ);
    setOpen(openJ, wasI);
    afterStructural();
    return;
  }

  if (act === 'order') {
    const list = state.settings.order;
    const raw = btn.dataset.swap;
    if (raw === '' || raw == null) return;
    const j = Number(raw);
    if (!Number.isInteger(j) || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    afterStructural();
    return;
  }

  if (act === 'see-sample') { openSample(state.settings.profession); return; }

  if (act === 'cover-scaffold') {
    if (String(state.cover.body || '').trim()
      && !confirm('Replace the letter you have written with the blank structure?')) return;
    state.cover.body = coverScaffold(state.basics, professionOf(state.settings));
    if (!state.cover.role) state.cover.role = state.basics.headline || '';
    afterStructural();
    setStagePane('letter');
    toast('Structure added. Replace every [bracketed prompt] with your own words.');
    return;
  }

  if (act === 'photo') { $('photoInput').click(); return; }

  if (act === 'photo-clear') {
    state.basics.photo = '';
    afterStructural();
  }
});

function afterStructural() {
  renderPanel();
  renderPreview();
  scheduleSave();
}

/* ---------------------------------------------------------------- photo */

$('photoInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('That file is not an image.'); return; }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 420;
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(max, side);
      canvas.height = canvas.width;
      const ctx = canvas.getContext('2d');
      // centre-crop to a square so every template gets a predictable shape
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side,
        0, 0, canvas.width, canvas.height);
      state.basics.photo = canvas.toDataURL('image/jpeg', 0.86);
      state.settings.showPhoto = true;
      afterStructural();
      toast('Photo added.');
    };
    img.onerror = () => toast('That image could not be read.');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

/* -------------------------------------------------------------- exports */

function slug(s) {
  return String(s || 'my').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my';
}

function baseName() {
  const who = slug(state.basics.fullName);
  return stagePane === 'letter' ? who + '-cover-letter' : who + '-cv';
}

function download(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

let cvCssCache = '';
async function cvCss() {
  if (!cvCssCache) cvCssCache = await fetch('/css/cv.css').then((r) => r.text());
  return cvCssCache;
}

async function standaloneHtml(forWord) {
  const css = await cvCss();
  const { html, classes } = stagePane === 'letter' ? renderLetterDoc(state) : renderCV(state);
  const [w, h] = PAPER_MM[state.settings.paper] || PAPER_MM.a4;
  const title = esc((state.basics.fullName || 'My') + ' - CV');

  const shell = forWord
    ? '@page WordSection1 { size: ' + w + 'mm ' + h + 'mm; margin: 0; }'
      + 'div.WordSection1 { page: WordSection1; }'
      + 'body { margin: 0; }'
    : 'body { margin: 0; background: #eef1f5; display: flex; justify-content: center; padding: 24px; }'
      + '@media print { body { padding: 0; background: #fff; display: block; } }';

  return '<!doctype html><html><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + title + '</title><style>' + shell + '\n' + css + '</style></head><body>'
    + (forWord ? '<div class="WordSection1">' : '')
    + '<div class="' + classes + '" style="--accent:' + esc(state.settings.accent)
    + ';--scale:' + (state.settings.scale / 100) + '">' + html + '</div>'
    + (forWord ? '</div>' : '')
    + '</body></html>';
}

async function runExport(act) {
  if (act === 'jd') {
    $('jdModal').classList.add('open');
    $('jdOut').hidden = true;
    $('jdNote').textContent = '';
    $('jdText').focus();
    return;
  }

  if (act === 'text') {
    // baseName() already carries the -cover-letter suffix in letter mode.
    download(baseName() + '.txt', 'text/plain;charset=utf-8',
      stagePane === 'letter' ? renderLetterText(state) : renderText(state));
    toast('Plain text downloaded - good for job portals that reject PDFs.');
    return;
  }
  if (act === 'save-json') {
    download(baseName() + '.json', 'application/json', JSON.stringify(state, null, 2));
    toast('Data file saved. Re-open it any time from More > Open a saved file.');
    return;
  }
  if (act === 'html') {
    download(baseName() + '.html', 'text/html;charset=utf-8', await standaloneHtml(false));
    toast('Web page downloaded - one self-contained file.');
    return;
  }
  if (act === 'word') {
    download(baseName() + '.doc', 'application/msword', await standaloneHtml(true));
    const sidebar = ['modern', 'creative'].includes(current().settings.template);
    toast(sidebar
      ? 'Word file downloaded. Word ignores side-by-side columns, so this format will stack - Classic, Minimal or ATS convert most faithfully.'
      : 'Word file downloaded. Open it in Word or Google Docs to keep editing.');
  }
}

/* ------------------------------------------------------------ top bar UI */

$('btnPdf').addEventListener('click', () => {
  // The sample banner no longer prints, so a sample PDF would look genuine.
  $('printSampleWarn').hidden = !sampleData_;
  $('printModal').classList.add('open');
});

$('btnPrintGo').addEventListener('click', () => {
  $('printModal').classList.remove('open');
  setTimeout(() => window.print(), 60);
});


$('btnMore').addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = $('moreMenu');
  menu.classList.toggle('open');
  $('btnMore').setAttribute('aria-expanded', String(menu.classList.contains('open')));
});

document.addEventListener('click', () => $('moreMenu').classList.remove('open'));

// Every dialog closes the same two ways: a click on the backdrop, or on
// anything marked data-close. This was wired per dialog, which meant each new
// one had to remember to do it - and the job-advert dialog did not, so its
// Close button and its backdrop both did nothing at all. Delegated here, a
// dialog cannot be added without a way out of it.
document.addEventListener('click', (e) => {
  const hit = e.target.classList.contains('modal-backdrop') ? e.target
    : (e.target.hasAttribute('data-close') ? e.target.closest('.modal-backdrop') : null);
  if (hit) hit.classList.remove('open');
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  $('moreMenu').classList.remove('open');
  document.querySelectorAll('.modal-backdrop.open')
    .forEach((m) => m.classList.remove('open'));
  // Not a .modal-backdrop, and it has timers to clear.
  closePlanet();
});

$('moreMenu').addEventListener('click', (e) => {
  const item = e.target.closest('[data-act]');
  if (!item) return;
  const act = item.dataset.act;
  $('moreMenu').classList.remove('open');

  if (act === 'load-json') { $('fileInput').click(); return; }
  // Their own buttons are hidden below 900px, so the menu carries them there.
  if (act === 'import') { openImport(); return; }
  if (act === 'example') { loadExample(); return; }
  if (act === 'linkedin') { openLinkedIn(); return; }

  if (act === 'reset') {
    if (!confirm('Clear every field and start from an empty CV? Download your data first if you want to keep it.')) return;
    state = blankData();
    afterStructural();
    toast('Cleared. Your formatting choices were reset too.');
    return;
  }

  runExport(act);
});

$('fileInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = migrate(JSON.parse(reader.result));
      afterStructural();
      toast('Loaded ' + file.name + '.');
    } catch {
      toast('That file is not an ihatejob data file.');
    }
  };
  reader.readAsText(file);
});

function loadExample() {
  const filled = state.basics.fullName || state.experience.length;
  if (filled && !confirm('Replace what you have with the example CV?')) return;
  const keep = state.settings;
  state = sampleData();
  state.settings = { ...state.settings, ...keep };
  afterStructural();
  toast('Example loaded. Edit any field to make it yours.');
}

$('btnExample').addEventListener('click', loadExample);

$('btnTheme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
});

$('zoomIn').addEventListener('click', () => { userZoomed = true; setZoom(zoom + 0.1); });
$('zoomOut').addEventListener('click', () => { userZoomed = true; setZoom(zoom - 0.1); });
$('zoomFit').addEventListener('click', () => { userZoomed = false; fitZoom(); });

/* ------------------------------------------------- editor / preview views */

// One place that sets the view, because three controls now drive it: the
// desktop toggle, the mobile bar, and "take me there" in the check pane.
function setView(name) {
  document.body.dataset.view = name;
  $('viewTabs').querySelectorAll('button').forEach((b) => {
    b.classList.toggle('sel', b.dataset.view === name);
  });
  // The stage was display:none until now, so it had no box to measure.
  if (name === 'preview') {
    if (!userZoomed) fitZoom();
    updatePageInfo();
  }
  syncMobileBar();
}

// On a phone the bottom bar replaces both the Edit/Preview toggle and the
// CV/Letter/Check tabs, so it has to reflect whichever of the two changed.
function syncMobileBar() {
  const active = document.body.dataset.view === 'edit' ? 'edit' : stagePane;
  $('mobileBar').querySelectorAll('[data-go]').forEach((b) => {
    const on = b.dataset.go === active;
    b.classList.toggle('sel', on);
    if (on) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  });
}

$('mobileBar').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-go]');
  if (!btn) return;
  if (btn.dataset.go === 'edit') {
    setView('edit');
  } else {
    setStagePane(btn.dataset.go);
    setView('preview');
  }
});

$('viewTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (btn) setView(btn.dataset.view);
});

window.addEventListener('resize', () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    if (!userZoomed) fitZoom();
    updatePageInfo();
  }, 150);
});

/* --------------------------------------------------------------- check */

const reviewPane = $('reviewPane');
let stagePane = 'preview';

function highlight(text, phrase) {
  const safe = esc(text);
  if (!phrase) return safe;
  const needle = esc(phrase);
  const at = safe.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return safe;
  return safe.slice(0, at) + '<mark>' + safe.slice(at, at + needle.length) + '</mark>'
    + safe.slice(at + needle.length);
}

const SEVERITY = {
  blocker: { label: 'Fix before you send this', badge: 'bad' },
  warn: { label: 'Worth fixing', badge: '' },
  tip: { label: 'Polish', badge: '' },
};

function findingHTML(f) {
  const where = f.where || {};
  const target = ' data-act="goto" data-sec="' + esc(where.section || '')
    + '" data-i="' + (Number.isInteger(where.index) ? where.index : '')
    + '" data-field="' + esc(where.field || '') + '"';

  const samples = (f.samples || []).length
    ? '<ul class="samples">' + f.samples.map((s) => (
      '<li>' + highlight(s.text, s.phrase)
      + (s.suggest ? '<span class="suggest">&rarr; ' + esc(s.suggest) + '</span>' : '')
      + '</li>'
    )).join('') + '</ul>'
    : '';

  return '<article class="finding ' + f.severity + '">'
    + '<h5>' + esc(f.title) + '</h5>'
    + '<p>' + esc(f.detail) + '</p>'
    + (f.fix ? '<p class="fix"><b>Do this:</b> ' + esc(f.fix) + '</p>' : '')
    + samples
    + (where.section ? '<div class="finding-actions">'
      + '<button class="btn btn-sm" type="button"' + target + '>Take me there</button></div>' : '')
    + '</article>';
}

function renderReview() {
  const r = reviewCV(current(), { pages: pageCount });

  const serious = r.findings.filter((f) => f.severity !== 'tip').length;
  const count = serious || r.findings.length || '0';
  const cls = 'tab-badge' + (serious ? ' bad' : r.findings.length ? '' : ' ok');
  // Two badges now: the stage tab, and the bottom bar on a phone.
  [$('reviewBadge'), $('mobileBadge')].forEach((badge) => {
    badge.textContent = count;
    badge.className = cls;
  });

  if (stagePane !== 'review') return;

  const ring = r.score >= 85 ? 'var(--ok)' : r.score >= 60 ? '#e8b451' : 'var(--danger)';
  const bandCls = (v, max) => (v / max >= 0.8 ? '' : v / max >= 0.5 ? ' mid' : ' low');

  const groups = ['blocker', 'warn', 'tip'].map((sev) => {
    const list = r.findings.filter((f) => f.severity === sev);
    if (!list.length) return '';
    return '<section class="find-group"><h4>' + SEVERITY[sev].label
      + ' (' + list.length + ')</h4>' + list.map(findingHTML).join('') + '</section>';
  }).join('');

  reviewPane.innerHTML = '<div class="review-inner">'
    + '<div class="score-card">'
    + '<div class="score-dial" style="--pct:' + r.score + ';--ring:' + ring + '"><b>' + r.score + '</b></div>'
    + '<div class="score-meta">'
    + '<h3>' + esc(r.grade) + ' <span class="score-letter">' + esc(r.letter) + '</span></h3>'
    + '<p class="verdict">' + esc(r.verdict) + '</p>'
    + '<p>Rated as a <b>' + esc(r.stats.profession) + '</b> CV for <b>' + esc(r.stats.region)
    + '</b>. Every check runs on your machine - nothing is uploaded, and no AI is involved.</p>'
    + '<div class="score-actions">'
    + '<button class="btn btn-sm" type="button" data-act="planet">Show my planet</button>'
    + '<button class="btn btn-sm" type="button" data-act="linkedin">Fix my LinkedIn</button>'
    + '<button class="btn btn-sm btn-primary" type="button" data-act="fix">Clean up automatically</button>'
    + '</div>'
    + '</div></div>'

    + '<div class="chars">' + r.bands.map((b) => (
      '<div class="char">'
      + '<div class="char-top"><span class="char-name">' + esc(b.name) + '</span>'
      + '<span class="char-letter g' + b.letter[0] + '">' + esc(b.letter) + '</span></div>'
      + '<span class="band-track"><span class="band-fill' + bandCls(b.score, b.max) + '"'
      + ' style="width:' + Math.round((b.score / b.max) * 100) + '%"></span></span>'
      + '<p class="char-blurb">' + esc(b.blurb) + '</p>'
      + '</div>'
    )).join('') + '</div>'

    + '<div class="stat-row">'
    + '<div class="stat"><b>' + r.stats.bullets + '</b>bullet points</div>'
    + '<div class="stat"><b>' + r.stats.metricPct + '%</b>carry a number</div>'
    + '<div class="stat"><b>' + r.stats.words + '</b>words</div>'
    + '<div class="stat"><b>' + r.stats.pages + '</b>pages (target ' + esc(r.stats.target) + ')</div>'
    + '</div>'

    + (groups || '<div class="review-clean"><b>Nothing to flag.</b>'
      + 'Every check passed for this profession and region.</div>')
    + '</div>';
}

function setStagePane(name) {
  const wasDoc = stagePane;
  stagePane = name;
  $('stageScroll').hidden = !(name === 'preview' || name === 'letter');
  reviewPane.hidden = name !== 'review';
  $('stageTabs').querySelectorAll('button').forEach((b) => {
    b.classList.toggle('sel', b.dataset.pane === name);
  });
  const onDoc = name === 'preview' || name === 'letter';
  for (const id of ['zoomIn', 'zoomOut', 'zoomFit', 'zoomLabel', 'pageInfo']) {
    $(id).style.display = onDoc ? '' : 'none';
  }
  for (const id of ['pageWarn']) $(id).hidden = name === 'letter' ? true : $(id).hidden;
  if (name === 'review') renderReview();
  else if (name !== wasDoc) renderPreview();
  else updatePageInfo();
  syncMobileBar();
}

$('stageTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pane]');
  if (btn) setStagePane(btn.dataset.pane);
});

// "Take me there" - open the right editor section and put the cursor in it.
reviewPane.addEventListener('click', (e) => {
  if (e.target.closest('[data-act="fix"]')) { openFixes(); return; }
  if (e.target.closest('[data-act="linkedin"]')) { openLinkedIn(); return; }
  if (e.target.closest('[data-act="planet"]')) {
    showPlanet(reviewCV(current(), { pages: pageCount }));
    return;
  }
  const btn = e.target.closest('[data-act="goto"]');
  if (!btn) return;
  const sec = btn.dataset.sec;
  const idx = btn.dataset.i === '' ? null : Number(btn.dataset.i);
  const field = btn.dataset.field;

  const accKey = sec;
  setOpen(accKey, true);
  if (idx != null && SECTIONS[sec] && !SECTIONS[sec].single) setOpen('item:' + sec + ':' + idx, true);
  setView('edit');
  renderPanel();

  // renderPanel writes innerHTML synchronously, so the new nodes are already
  // queryable here - no need to wait a frame.
  const accEl = panel.querySelector('[data-acc="' + accKey + '"]');
  if (accEl) accEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // The summary lives on basics rather than in a list, so it needs its own path.
  let path = '';
  if (sec === 'summary') path = 'basics.summary';
  else if (sec === 'basics' && field) path = 'basics.' + field;
  else if (idx != null && field && SECTIONS[sec] && !SECTIONS[sec].single) {
    path = sec + '.' + idx + '.' + field;
  }
  const input = path ? panel.querySelector('[data-path="' + path + '"]') : null;
  if (input) input.focus({ preventScroll: true });
});

/* ---------------------------------------------------------- auto clean-up */

function openFixes() {
  const fixes = availableFixes(state);
  if (!fixes.length) {
    toast('Nothing here can be fixed mechanically - what is left needs your judgement.');
    return;
  }
  $('fixList').innerHTML = fixes.map((f) => (
    '<label class="fix-row' + (f.destructive ? ' destructive' : '') + '">'
    + '<input type="checkbox" value="' + esc(f.id) + '" checked>'
    + '<span class="fix-body"><b>' + esc(f.label) + '</b>'
    + '<span class="fix-count">' + f.count + (f.count === 1 ? ' place' : ' places') + '</span>'
    + '<span class="fix-detail">' + esc(f.detail) + '</span></span>'
    + '</label>'
  )).join('');
  $('fixModal').classList.add('open');
}

$('fixApply').addEventListener('click', () => {
  const ids = [...$('fixList').querySelectorAll('input:checked')].map((i) => i.value);
  if (!ids.length) { $('fixModal').classList.remove('open'); return; }

  const before = reviewCV(state, { pages: pageCount }).score;
  const { data, applied } = applyFixes(state, ids);
  state = migrate(data);
  $('fixModal').classList.remove('open');
  afterStructural();

  const after = reviewCV(state, { pages: pageCount }).score;
  const total = applied.reduce((n, a) => n + a.count, 0);
  toast('Cleaned ' + total + (total === 1 ? ' place' : ' places') + '. Score '
    + before + ' → ' + after + '.');
});


/* --------------------------------------------------------- fix my LinkedIn */

// LinkedIn's own field limits. Nothing can write to a profile through an API,
// so the most this can do is size the text correctly and check it.
const LI_FIELDS = [
  {
    k: 'headline', label: 'Headline', limit: 220, rows: 2,
    hint: 'One line. What you do, not what you are like.',
    from: (d) => d.basics.headline,
  },
  {
    k: 'about', label: 'About', limit: 2600, rows: 7,
    hint: 'LinkedIn shows the first ~3 lines before "see more". Put the point there.',
    from: (d) => d.basics.summary,
  },
];

function liFieldsFor(d) {
  const roles = d.experience.slice(0, 3).map((e, i) => ({
    k: 'role' + i,
    label: 'Role — ' + (e.role || e.company || 'Experience ' + (i + 1)),
    limit: 2000,
    rows: 5,
    hint: 'One achievement per line, the same as the CV.',
    from: () => String(e.bullets || ''),
  }));
  return [...LI_FIELDS, ...roles];
}

function liRefresh(k) {
  const box = document.getElementById('li-' + k);
  if (!box) return;
  const limit = Number(box.dataset.limit);
  const n = box.value.length;
  const count = document.getElementById('lic-' + k);
  count.textContent = n.toLocaleString() + ' / ' + limit.toLocaleString();
  count.classList.toggle('over', n > limit);

  const flags = document.getElementById('lif-' + k);
  const hits = checkPhrases(box.value);
  if (!hits.length) {
    flags.className = 'li-clear';
    flags.textContent = box.value.trim()
      ? 'Nothing flagged. This one would pass.'
      : 'Empty — LinkedIn will show nothing here.';
    return;
  }
  flags.className = 'li-flags';
  flags.innerHTML = hits.map((h) => (
    '<span class="li-flag' + (h.kind === 'tell' ? '' : ' soft') + '">'
    + esc(h.replacement ? h.phrase + ' → ' + h.replacement : h.phrase) + '</span>'
  )).join('');
}

function openLinkedIn() {
  const fields = liFieldsFor(state);
  $('liFields').innerHTML = fields.map((f) => (
    '<div class="li-field">'
    + '<div class="li-head"><label for="li-' + f.k + '">' + esc(f.label) + '</label>'
    + '<span class="li-count" id="lic-' + f.k + '"></span>'
    + '<button class="btn btn-sm" type="button" data-licopy="' + f.k + '">Copy</button></div>'
    + '<textarea class="input li-box" id="li-' + f.k + '" rows="' + f.rows + '"'
    + ' data-limit="' + f.limit + '">' + esc(f.from(state) || '') + '</textarea>'
    + '<p class="li-hint">' + esc(f.hint) + '</p>'
    + '<div id="lif-' + f.k + '"></div>'
    + '</div>'
  )).join('');

  fields.forEach((f) => liRefresh(f.k));
  $('liModal').classList.add('open');
}

$('liFields').addEventListener('input', (e) => {
  const box = e.target.closest('.li-box');
  if (box) liRefresh(box.id.slice(3));
});

$('liFields').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-licopy]');
  if (!btn) return;
  const box = document.getElementById('li-' + btn.dataset.licopy);
  try {
    await navigator.clipboard.writeText(box.value);
    const was = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = was; }, 1400);
  } catch {
    box.select();
    toast('Press Ctrl+C to copy.');
  }
});


/* ------------------------------------------------------- planet result */

let skyBuilt = false;
let showTimers = [];

function buildSky() {
  if (skyBuilt) return;
  const sky = $('planetSky');
  let html = '';
  for (let i = 0; i < 110; i += 1) {
    const size = (Math.random() * 2 + 0.7).toFixed(2);
    html += '<i style="left:' + (Math.random() * 100).toFixed(2) + '%;'
      + 'top:' + (Math.random() * 100).toFixed(2) + '%;'
      + 'width:' + size + 'px;height:' + size + 'px;'
      + 'animation-delay:' + (Math.random() * 3.2).toFixed(2) + 's"></i>';
  }
  sky.innerHTML = html;
  skyBuilt = true;
}

const RAIL_GAP = 150;   // must match .rail gap in app.css
const RAIL_ITEM = 150;  // planet svg width

function clearShowTimers() {
  showTimers.forEach(clearTimeout);
  showTimers = [];
}

function countUp(el, to, ms) {
  const started = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - started) / ms);
    el.textContent = Math.round(to * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // rAF does not fire in a background or non-compositing tab, so guarantee the
  // final number lands either way.
  showTimers.push(setTimeout(() => { el.textContent = to; }, ms + 120));
}

/**
 * Fly out from Mercury and decelerate onto the planet earned, then land the
 * card. Clicking anywhere during the flight jumps straight to the end.
 */
function showPlanet(r) {
  const p = planetFor(r.score);
  const stars = starsFor(p.rank);
  const show = $('planetModal');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  clearShowTimers();
  buildSky();
  show.classList.remove('arrived', 'travelling');

  // The rail holds Mercury up to the planet earned; it starts centred on
  // Mercury and travels the whole way.
  $('planetRail').innerHTML = PLANETS.slice(0, p.rank).map((x) => (
    '<div class="rail-item' + (x.rank === p.rank ? ' target' : '') + '">'
    + planetSVG(x, RAIL_ITEM)
    + '<span class="rail-name">' + esc(x.name) + '</span>'
    + '</div>'
  )).join('');

  $('planetTitle').innerHTML = '<span class="planet-rank">' + p.rank + ' of 10</span><br>' + esc(p.name);
  $('planetStars').innerHTML = starRow(stars, 22);
  $('planetLine').innerHTML = '<span class="planet-tag">' + esc(p.tag) + '.</span> ' + esc(p.line)
    + '<div class="score-line"><b id="planetScore">0</b><span>/100</span>'
    + '<i>' + esc(r.letter) + '</i></div>'
    + '<div style="margin-top:8px">Rated as a ' + esc(r.stats.profession)
    + ' CV for ' + esc(r.stats.region) + '.</div>';

  $('planetScale').innerHTML = PLANETS.map((x) => (
    '<div class="scale-row' + (x.rank === p.rank ? ' now' : '') + '">'
    + '<span class="n">' + x.rank + '</span>'
    + '<span class="who">' + esc(x.name) + '</span>'
    + starRow(starsFor(x.rank), 12)
    + '<span class="sc">' + ((x.rank - 1) * 10) + '-' + (x.rank * 10 - (x.rank === 10 ? 0 : 1)) + '</span>'
    + '</div>'
  )).join('');
  $('planetScale').hidden = true;
  $('planetScaleToggle').textContent = 'Show the whole scale';
  $('planetSkip').hidden = p.rank === 1 || reduced;

  show.hidden = false;

  // Landing state: stop the rail, reveal the card, fill the stars, count up.
  const land = () => {
    clearShowTimers();
    show.classList.remove('travelling');
    show.classList.add('arrived');
    const litStars = show.querySelectorAll('#planetStars .star');
    litStars.forEach((el, i) => {
      showTimers.push(setTimeout(() => el.classList.add('lit'), reduced ? 0 : 240 + i * 110));
    });
    const score = $('planetScore');
    if (score) {
      if (reduced) score.textContent = r.score;
      else showTimers.push(setTimeout(() => countUp(score, r.score, 700), 300));
    }
  };
  show._land = land;

  if (reduced || p.rank === 1) {
    $('planetRail').style.transition = 'none';
    $('planetRail').style.transform = 'translateX(0)';
    land();
    return;
  }

  // Distance to travel, and a duration that grows with it but stays under ~2s.
  const steps = p.rank - 1;
  const distance = steps * (RAIL_ITEM + RAIL_GAP);
  const duration = Math.min(2000, 780 + steps * 140);

  const rail = $('planetRail');
  rail.style.transition = 'none';
  rail.style.transform = 'translateX(0)';
  // force a reflow so the browser does not collapse the two transforms into one
  void rail.offsetWidth;
  show.classList.add('travelling');
  rail.style.transition = 'transform ' + duration + 'ms cubic-bezier(0.16, 1, 0.3, 1)';
  rail.style.transform = 'translateX(-' + distance + 'px)';

  showTimers.push(setTimeout(land, duration + 120));
}

$('planetScaleToggle').addEventListener('click', (e) => {
  e.stopPropagation();
  const box = $('planetScale');
  box.hidden = !box.hidden;
  $('planetScaleToggle').textContent = box.hidden ? 'Show the whole scale' : 'Hide the scale';
});

$('planetSeeWhy').addEventListener('click', (e) => {
  e.stopPropagation();
  closePlanet();
  setStagePane('review');
});

function closePlanet() {
  clearShowTimers();
  const show = $('planetModal');
  show.hidden = true;
  show.classList.remove('arrived', 'travelling');
}

$('planetModal').addEventListener('click', (e) => {
  const show = $('planetModal');
  if (!show.classList.contains('arrived')) {
    if (show._land) show._land();   // skip the flight
    return;
  }
  if (e.target === show || e.target.hasAttribute('data-close')) closePlanet();
});

/* -------------------------------------------------------------- samples */

// Sample mode renders a worked example in the preview without touching the
// user's own data, so looking at one costs nothing.
let sampleData_ = null;

function openSample(profId) {
  const built = buildSample(profId, state.settings);
  if (!built) { toast('No sample written for this profession yet.'); return; }
  sampleData_ = built;
  setStagePane('preview');
  setView('preview');
  $('sampleBar').hidden = false;
  $('sampleWho').textContent = professionOf(built.settings).name;
  renderPreview();
  if (!userZoomed) fitZoom();
}

function closeSample() {
  sampleData_ = null;
  $('sampleBar').hidden = true;
  renderPreview();
}

$('sampleClose').addEventListener('click', closeSample);

$('sampleUse').addEventListener('click', () => {
  if (!sampleData_) return;
  if (!confirm('Replace your CV with this sample? Your current content will be lost.')) return;
  state = migrate(sampleData_);
  closeSample();
  afterStructural();
  toast('Sample loaded. Replace the details with your own.');
});

/* -------------------------------------------------------------- import */

let pendingImport = null;
let pendingReport = null;

function openImport() {
  $('importModal').classList.add('open');
  $('importStep1').hidden = false;
  $('importStep2').hidden = true;
  importError('');
  pendingImport = null;
}

$('btnImport').addEventListener('click', openImport);


function importError(msg) {
  const box = $('importError');
  box.textContent = msg;
  box.hidden = !msg;
}

// A file dropped anywhere except the small dropzone used to make the browser
// navigate away to that file, losing the whole app. Catch it at the window and
// treat any drop on the page as an import.
const veil = $('dropVeil');
let dragDepth = 0;

function hasFiles(e) {
  return Boolean(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'));
}

window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth += 1;
  veil.hidden = false;
});
window.addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
window.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) veil.hidden = true;
});
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  veil.hidden = true;
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  openImport();
  readCVFile(file);
});

const dropzone = $('dropzone');
dropzone.addEventListener('click', () => $('cvInput').click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('cvInput').click(); }
});
['dragenter', 'dragover'].forEach((ev) => dropzone.addEventListener(ev, (e) => {
  e.preventDefault();
  dropzone.classList.add('over');
}));
['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, (e) => {
  e.preventDefault();
  dropzone.classList.remove('over');
}));
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) readCVFile(file);
});

$('cvInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (file) readCVFile(file);
});

async function readCVFile(file) {
  try {
    importError('');
    toast('Reading ' + file.name + '...');
    const out = await fileToText(file);
    if (out.json) {
      state = migrate(JSON.parse(out.text));
      $('importModal').classList.remove('open');
      afterStructural();
      toast('Loaded your saved data file.');
      return;
    }
    // A LinkedIn archive is a set of CSVs, not prose - there is no text to show
    // in the paste box, so it goes straight to the report.
    if (out.csvs) {
      showImportReport(parseLinkedInArchive(out.csvs, importBase()));
      toast('Read the LinkedIn archive.');
      return;
    }
    $('pasteBox').value = out.text;
    toast('Read the ' + out.how + '. Check the text below, then press "Read it".');
  } catch (err) {
    const msg = err instanceof ImportError
      ? err.message
      : 'That file could not be read (' + (err && err.message ? err.message : 'unknown error')
        + '). Open it, select all, copy, and paste the text below instead.';
    importError(msg);
    toast('Could not read that file - see the message in the dialog.');
  }
}

// Keep the current profession and region - those are choices, not content.
function importBase() {
  const base = blankData();
  base.settings = JSON.parse(JSON.stringify(state.settings));
  return base;
}

/*
 * A gap the parser left, with somewhere to put what it missed.
 *
 * The flag used to name the miss and then offer one thing: throw the import
 * away and start from an example. For the commonest case by far - the CV that
 * read fine except for education, which is plainly there in the PDF - that is
 * a bad trade, and it is what makes someone decide the site is broken. Pasting
 * the four lines it could not find keeps everything it did get right.
 */
const RESCUE_ASK = {
  name: ['Type your name.', 'Ahmad Khan', 1],
  contact: ['Type an email address, a phone number, or both.',
    'ahmad@example.com   +91 98765 43210', 1],
  experience: ['Is it in your CV after all? Copy the work experience out and paste it here.',
    'Product Manager&#10;Flipkart&#10;June 2021 - August 2024&#10;'
    + '&bull; Owned the returns experience.', 5],
  education: ['Is it in your CV after all? Copy the education lines out and paste them here.',
    'B.Tech Computer Science, IIT Delhi   2014 - 2018&#10;CGPA 8.7', 4],
};

function rescueBox(gap) {
  const ask = RESCUE_ASK[gap.id];
  if (!ask) return '';
  const [prompt, placeholder, rows] = ask;
  const field = rows > 1
    ? '<textarea class="input rescue-box" id="rescueBox-' + gap.id + '" rows="' + rows
      + '" placeholder="' + placeholder + '"></textarea>'
    : '<input class="input rescue-box" id="rescueBox-' + gap.id + '" type="text" placeholder="'
      + placeholder + '">';
  return '<div class="rescue">'
    + '<p class="rescue-ask">' + prompt + '</p>'
    + field
    + '<div class="rescue-row">'
    + '<button class="btn btn-sm btn-primary" type="button" data-rescue="' + gap.id + '">Read this bit</button>'
    + '<span class="rescue-said" id="rescueSaid-' + gap.id + '"></span>'
    + '</div></div>';
}

function runRescue(id) {
  const box = $('rescueBox-' + id);
  if (!box || !pendingImport || !pendingReport) return;
  const said = (msg) => { const el = $('rescueSaid-' + id); if (el) el.textContent = msg; };
  const text = (box.value || '').trim();
  if (!text) { said('Nothing pasted in yet.'); return; }

  let label = '';
  if (id === 'name') {
    // Someone typing into a box marked "your name" has told us their name. The
    // parser is a second opinion here, not a gatekeeper.
    const typed = text.replace(/\s+/g, ' ');
    const name = parseIdentity(typed).fullName
      || (/^[^@\d]{2,60}$/.test(typed) ? typed : '');
    if (!name) { said('That does not look like a name.'); return; }
    pendingImport.basics.fullName = name;
    pendingReport.name = name;
    label = 'your name';
  } else if (id === 'contact') {
    const got = parseIdentity(text);
    if (!got.email && !got.phone) { said('No email address or phone number in that.'); return; }
    if (got.email) pendingImport.basics.email = got.email;
    if (got.phone) pendingImport.basics.phone = got.phone;
    label = [got.email && 'an email address', got.phone && 'a phone number']
      .filter(Boolean).join(' and ');
  } else {
    const items = parseSection(id, text);
    if (!items.length) {
      said('Nothing readable came out of that. One entry per block: title, employer, dates.');
      return;
    }
    pendingImport[id].push(...items);
    pendingReport.counts[id] = pendingImport[id].length;
    if (id === 'experience') {
      pendingReport.notes = pendingReport.notes
        .filter((n) => !/^No work experience was found/.test(n));
    }
    label = items.length + ' ' + (SECTIONS[id] ? SECTIONS[id].title.toLowerCase() : id)
      + (items.length === 1 ? ' entry' : ' entries');
  }

  pendingReport.rescued = (pendingReport.rescued || []).concat(label);
  pendingReport.alignment = recheck(pendingImport, pendingReport);
  showImportReport({ data: pendingImport, report: pendingReport });
}

// One listener for a panel that is rebuilt on every rescue, so nothing stacks up.
$('importReport').addEventListener('click', (e) => {
  const rescue = e.target.closest('[data-rescue]');
  if (rescue) { runRescue(rescue.dataset.rescue); return; }
  if (e.target.closest('#alignExample')) {
    $('importModal').classList.remove('open');
    pendingImport = null;
    pendingReport = null;
    loadExample();
  }
});

function showImportReport({ data, report }) {
  pendingImport = data;
  pendingReport = report;

  const rows = Object.entries(report.counts)
    .filter(([id]) => SECTIONS[id])
    .map(([id, n]) => '<li class="' + (n ? '' : 'none') + '"><span>' + esc(SECTIONS[id].title)
      + '</span><span class="n">' + (n || 'not found') + '</span></li>').join('');

  const head = report.source === 'LinkedIn archive'
    ? '<p style="margin-bottom:10px">Read your <b>LinkedIn archive</b>'
      + (report.name ? ' for <b>' + esc(report.name) + '</b>' : '') + '.</p>'
      + '<div class="report-note">Only your profile files were opened: <b>'
      + esc((report.read || []).join(', ')) + '</b>. The rest of the archive &mdash; messages, '
      + 'connections, ad targeting &mdash; was left alone.</div>'
    : '<p style="margin-bottom:10px">Read <b>' + report.chars.toLocaleString() + '</b> characters'
      + (report.source ? ' from your <b>' + esc(report.source) + '</b>' : '')
      + (report.name ? ' for <b>' + esc(report.name) + '</b>' : '') + '.</p>';

  // Headings the parser did not recognise. Whatever sat under one of these went
  // somewhere it did not belong, so naming it is far more use than a section
  // that reads "not found" with no clue why.
  const unknown = report.unknownHeadings || [];
  const unknownNote = unknown.length
    ? '<div class="report-note report-unknown"><b>Not recognised as headings:</b> '
      + unknown.map((h) => '<code>' + esc(h) + '</code>').join(', ')
      + (unknown.length > 1
        ? '. Anything under those went into the section above it. If one of them is '
        : '. Anything under it went into the section above. If that is ')
      + 'your education or experience, renaming it to the ordinary word fixes the '
      + 'import.</div>'
    : '';

  // When a core section could not be read, say so at the top and offer a way
  // out of it. A visitor shown "Education - not found" and nothing else decides
  // the site is broken, and they are half right: the miss is real, and saying
  // nothing about it is the part that loses them.
  const a = report.alignment || { level: 'clean', missing: [], why: [] };
  const listMissing = (m) => (m.length === 1 ? m[0]
    : m.slice(0, -1).join(', ') + ' or ' + m[m.length - 1]);
  const alignNote = a.level === 'clean' ? '' : (
    '<div class="align-flag align-' + a.level + '">'
    + '<b>' + (a.level === 'poor'
      ? 'This CV did not read cleanly.'
      : 'One part of this CV did not read cleanly.') + '</b>'
    + '<p>A machine could not find ' + esc(listMissing(a.missing)) + ' in it. '
    + 'That is roughly what an employer&rsquo;s software would store as empty too, '
    + 'so it is worth knowing whichever route you take from here.</p>'
    + a.why.map((w) => '<p class="align-why">' + esc(w) + '</p>').join('')
    + (a.gaps || []).map(rescueBox).join('')
    + '<div class="align-actions">'
    + '<button class="btn btn-sm" type="button" id="alignExample">'
    + 'Start from a worked example instead</button>'
    + '<span class="hint">Built for your profession, and it reads cleanly by construction. '
    + 'Your file is not touched.</span>'
    + '</div></div>');

  const rescuedNote = (report.rescued || []).length
    ? '<div class="report-note report-rescued">Added by hand, not read from the file: <b>'
      + esc(report.rescued.join(', ')) + '</b>.</div>'
    : '';

  $('importReport').innerHTML = head
    + alignNote
    + rescuedNote
    + report.notes.map((n) => '<div class="report-note">' + esc(n) + '</div>').join('')
    + unknownNote
    + '<ul class="report-list">' + rows + '</ul>'
    + '<p style="margin:0">'
    + (report.source === 'LinkedIn archive'
      ? 'These came from real fields, so they should be accurate.'
      : 'Parsing a CV from formatting alone is approximate.')
    + ' Nothing is applied until you press Use this, and everything stays editable afterwards.</p>';

  $('importStep1').hidden = true;
  $('importStep2').hidden = false;
}

$('btnParse').addEventListener('click', () => {
  const text = $('pasteBox').value.trim();
  if (text.length < 40) {
    importError('There is no text to read yet. Choose a file above, or paste your CV text here.');
    return;
  }
  importError('');
  showImportReport(parseCV(text, importBase()));
});

$('btnImportBack').addEventListener('click', () => {
  $('importStep1').hidden = false;
  $('importStep2').hidden = true;
});

$('btnImportApply').addEventListener('click', () => {
  if (!pendingImport) return;
  state = migrate(pendingImport);
  pendingImport = null;
  $('importModal').classList.remove('open');
  afterStructural();
  setStagePane('review');
  showPlanet(reviewCV(state, { pages: pageCount }));
});

/* --------------------------------------------------------- layout watch */

// The preview can be measured only once it actually has a box: the pane may
// start hidden or zero-width, and web fonts land after first paint. Watching
// both boxes keeps the page count and the fit zoom honest without polling.
let infoTimer = 0;
const watchPage = new ResizeObserver(() => {
  clearTimeout(infoTimer);
  infoTimer = setTimeout(updatePageInfo, 60);
});
watchPage.observe(cvPage);

const watchStage = new ResizeObserver(() => {
  if (!userZoomed) fitZoom();
});
watchStage.observe(stageScroll);

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(updatePageInfo).catch(() => {});
}

/* ----------------------------------------------------------------- boot */

measureMm();
setView('edit');
renderPanel();
renderPreview();
setZoom(1);
fitZoom();
scheduleSave(); // so the "Saved" pill is true even on a first visit

/* ------------------------------------------------- links from the site */

// The landing page deep-links in: /app?profession=law, /app?import=1
(() => {
  const params = new URLSearchParams(location.search);
  const prof = params.get('profession');
  const wantsImport = params.get('import');

  if (prof && Object.prototype.hasOwnProperty.call(PROFESSIONS, prof)) {
    applyProfession(state, prof);
    afterStructural();
  }
  if (wantsImport) openImport();

  // Drop the query string so a refresh does not re-apply it.
  if (prof || wantsImport) {
    history.replaceState(null, '', location.pathname);
  }
})();

initPWA({ onToast: toast });

/* ------------------------------------------ checking against an advert */

// The terms are always listed. A number on its own would hide a bad reading of
// the advert behind a confident-looking score; a list lets anyone see at a
// glance that it has misread one.
// An advert is as likely to arrive as a PDF or a Word file as it is to be
// pasted, and fileToText already reads all three. What it gets goes into the
// box rather than straight into the comparison: a JD read badly out of a PDF
// would otherwise produce confident nonsense with nothing to show for it.
async function readAdvert(file) {
  if (!file) return;
  // Checked here rather than left to fileToText, whose refusal talks about
  // LinkedIn archives and saved .json - neither of which is a job advert.
  if (!/\.(pdf|docx?|rtf|txt|md)$/i.test(file.name)) {
    $('jdNote').textContent = 'That is not something an advert comes in. Use a PDF, a Word file or plain text - or paste it below.';
    return;
  }
  $('jdNote').textContent = 'Reading ' + file.name + '...';
  try {
    const out = await fileToText(file);
    const text = String(out.text || out || "").trim();
    if (!text) throw new ImportError("Nothing readable came out of that file.");
    $('jdText').value = text;
    $('jdNote').textContent = 'Read ' + text.length.toLocaleString() + ' characters. '
      + 'Check it looks right, then compare.';
  } catch (err) {
    $('jdNote').textContent = err instanceof ImportError ? err.message
      : 'That file could not be read. Paste the advert instead.';
  }
}

const jdDrop = $('jdDrop');
jdDrop.addEventListener('click', () => $('jdInput').click());
jdDrop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('jdInput').click(); }
});
['dragenter', 'dragover'].forEach((ev) => jdDrop.addEventListener(ev, (e) => {
  e.preventDefault();
  jdDrop.classList.add('over');
}));
['dragleave', 'drop'].forEach((ev) => jdDrop.addEventListener(ev, (e) => {
  e.preventDefault();
  jdDrop.classList.remove('over');
}));
jdDrop.addEventListener('drop', (e) => readAdvert(e.dataTransfer.files[0]));
$('jdInput').addEventListener('change', (e) => {
  readAdvert(e.target.files[0]);
  e.target.value = '';
});

$('jdRun').addEventListener('click', () => {
  const jd = $('jdText').value.trim();
  if (jd.length < 40) {
    $('jdNote').textContent = 'Paste a bit more of the advert first.';
    return;
  }
  $('jdNote').textContent = '';

  const r = matchJD(jd, renderText(state));
  const out = $('jdOut');

  if (!r.total) {
    out.innerHTML = '<p class="hint">' + esc(r.verdict) + '</p>';
    out.hidden = false;
    return;
  }

  const chip = (t) => '<span class="jd-term' + (t.found ? ' on' : '') + '">'
    + (t.found ? '&#10003; ' : '') + esc(t.label || t.term) + '</span>';

  const group = (weight, title, note) => {
    const items = r.terms.filter((t) => t.weight === weight);
    if (!items.length) return '';
    return '<h3 class="jd-h">' + title + '</h3>'
      + (note ? '<p class="hint">' + note + '</p>' : '')
      + '<div class="jd-terms">' + items.map(chip).join('') + '</div>';
  };

  out.innerHTML = '<p class="jd-verdict"><b>' + r.covered + ' of ' + r.total
    + '</b> things this advert asks for are findable in your CV.</p>'
    + '<p>' + esc(r.verdict) + '</p>'
    + group('must', 'Asked for', 'Listed under requirements, or marked as required.')
    + group('nice', 'Nice to have', 'Worth having, not worth inventing.')
    + group('body', 'Mentioned in passing', 'Picked up from the rest of the advert.')
    + '<p class="hint jd-warn">These are words a recruiter&rsquo;s search would look for. '
    + 'Add any that are <b>true of you</b> and missing &mdash; and none that are not. '
    + 'A CV stuffed with terms you cannot talk about falls apart in the first interview, '
    + 'and this tool cannot tell the difference.</p>';
  out.hidden = false;
});
