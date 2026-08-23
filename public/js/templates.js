// CV rendering. Six templates share two DOM shapes (single column and
// sidebar); the visual differences live in css/cv.css keyed off .tpl-*.

import { dateRange } from './schema.js';

export const TEMPLATES = {
  classic: { name: 'Classic', blurb: 'Serif, centred header, ruled sections', layout: 'single' },
  minimal: { name: 'Minimal', blurb: 'Quiet and roomy, no decoration', layout: 'single' },
  ats: { name: 'ATS Plain', blurb: 'Plain text-like, safest for parsers', layout: 'single' },
  executive: { name: 'Executive', blurb: 'Headings in a left margin column', layout: 'single' },
  modern: { name: 'Modern', blurb: 'Colour sidebar on the left', layout: 'sidebar', sidePos: 'left' },
  creative: { name: 'Creative', blurb: 'Accent banner with a right rail', layout: 'sidebar', sidePos: 'right' },
  academic: { name: 'Academic', blurb: 'Long-form CV for research records', layout: 'single' },
  federal: { name: 'Detailed', blurb: 'Dense bio-data for government forms', layout: 'single' },
};

const SIDE_SECTIONS = {
  modern: ['skills', 'languages', 'certifications'],
  creative: ['skills', 'languages', 'certifications', 'achievements'],
};

const TITLES = {
  summary: 'Profile',
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  skills: 'Skills',
  certifications: 'Certifications',
  licences: 'Licences & Registrations',
  publications: 'Publications',
  languages: 'Languages',
  achievements: 'Achievements',
};

// A profession pack may rename a section - "Experience" becomes "Clinical
// Experience" for nursing, "Research Interests" for academia.
function titleFor(d, id) {
  const custom = d.settings.labels && d.settings.labels[id];
  return custom || TITLES[id] || id;
}

const LEVELS = { Native: 5, Fluent: 4, Advanced: 4, Intermediate: 3, Basic: 2 };

/* ---------------------------------------------------------------- helpers */

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function lines(s) {
  return String(s || '').split('\n').map((l) => l.trim()).filter(Boolean);
}

function has(s) {
  return Boolean(String(s || '').trim());
}

function href(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  return /^(https?:|mailto:|tel:)/i.test(u) ? u : 'https://' + u;
}

function points(list, cls) {
  if (!list.length) return '';
  const items = list.map((l) => '<li>' + esc(l) + '</li>').join('');
  return '<ul class="' + (cls || 'cv-points') + '">' + items + '</ul>';
}

function entry(o) {
  const idBits = [];
  if (has(o.title)) idBits.push('<h4 class="cv-entry-title">' + o.title + '</h4>');
  if (has(o.subtitle)) idBits.push('<div class="cv-entry-sub">' + esc(o.subtitle) + '</div>');

  const metaBits = [];
  if (has(o.meta)) metaBits.push('<div class="cv-entry-date">' + esc(o.meta) + '</div>');
  if (has(o.meta2)) metaBits.push('<div class="cv-entry-note">' + esc(o.meta2) + '</div>');

  if (!idBits.length && !metaBits.length && !o.bullets.length) return '';

  return '<article class="cv-entry">'
    + '<div class="cv-entry-top">'
    + '<div class="cv-entry-id">' + idBits.join('') + '</div>'
    + '<div class="cv-entry-meta">' + metaBits.join('') + '</div>'
    + '</div>'
    + points(o.bullets)
    + '</article>';
}

/* -------------------------------------------------------- section bodies */

const BODY = {
  summary(d) {
    const paras = lines(d.basics.summary);
    if (!paras.length) return '';
    return paras.map((p) => '<p class="cv-summary">' + esc(p) + '</p>').join('');
  },

  experience(d) {
    return d.experience.map((it) => entry({
      title: esc(it.role),
      subtitle: [it.company, it.location].filter(has).join(', '),
      meta: dateRange(it),
      bullets: lines(it.bullets),
    })).join('');
  },

  education(d) {
    return d.education.map((it) => entry({
      title: esc(it.degree),
      subtitle: [it.school, it.location].filter(has).join(', '),
      meta: dateRange(it),
      meta2: it.score,
      bullets: lines(it.details),
    })).join('');
  },

  projects(d) {
    return d.projects.map((it) => {
      const link = href(it.link);
      const title = link
        ? esc(it.name) + ' <a class="cv-link" href="' + esc(link) + '">' + esc(it.link) + '</a>'
        : esc(it.name);
      return entry({
        title,
        subtitle: it.tech,
        meta: it.date,
        bullets: lines(it.bullets),
      });
    }).join('');
  },

  skills(d, variant) {
    const groups = d.skills.filter((g) => has(g.group) || has(g.items));
    if (!groups.length) return '';

    if (variant === 'side') {
      return groups.map((g) => {
        const chips = String(g.items || '').split(',').map((s) => s.trim()).filter(Boolean)
          .map((s) => '<span class="cv-chip">' + esc(s) + '</span>').join('');
        return (has(g.group) ? '<div class="cv-side-label">' + esc(g.group) + '</div>' : '')
          + '<div class="cv-chips">' + chips + '</div>';
      }).join('');
    }

    return '<div class="cv-skills">' + groups.map((g) => (
      '<div class="cv-skill">'
      + '<span class="cv-skill-name">' + esc(g.group) + '</span>'
      + '<span class="cv-skill-list">' + esc(g.items) + '</span>'
      + '</div>'
    )).join('') + '</div>';
  },

  certifications(d, variant) {
    const list = d.certifications.filter((c) => has(c.name));
    if (!list.length) return '';

    if (variant === 'side') {
      return '<ul class="cv-side-list">' + list.map((c) => (
        '<li><strong>' + esc(c.name) + '</strong>'
        + (has(c.issuer) || has(c.year)
          ? '<span>' + esc([c.issuer, c.year].filter(has).join(', ')) + '</span>' : '')
        + '</li>'
      )).join('') + '</ul>';
    }

    return list.map((c) => {
      const link = href(c.link);
      const name = link
        ? '<a class="cv-link" href="' + esc(link) + '">' + esc(c.name) + '</a>'
        : esc(c.name);
      return '<div class="cv-line">'
        + '<span class="cv-line-main">' + name
        + (has(c.issuer) ? ' <span class="cv-muted">- ' + esc(c.issuer) + '</span>' : '')
        + '</span>'
        + (has(c.year) ? '<span class="cv-line-meta">' + esc(c.year) + '</span>' : '')
        + '</div>';
    }).join('');
  },

  languages(d, variant) {
    const list = d.languages.filter((l) => has(l.name));
    if (!list.length) return '';

    if (variant === 'side') {
      return '<div class="cv-langs">' + list.map((l) => {
        const filled = LEVELS[l.level] || 3;
        let dots = '';
        for (let i = 1; i <= 5; i += 1) {
          dots += '<i class="cv-dot' + (i <= filled ? ' on' : '') + '"></i>';
        }
        return '<div class="cv-lang">'
          + '<span>' + esc(l.name) + '</span>'
          + '<span class="cv-dots" title="' + esc(l.level) + '">' + dots + '</span>'
          + '</div>';
      }).join('') + '</div>';
    }

    return '<p class="cv-inline">' + list
      .map((l) => esc(l.name) + (has(l.level) ? ' <span class="cv-muted">(' + esc(l.level) + ')</span>' : ''))
      .join('<span class="cv-sep">·</span>') + '</p>';
  },

  achievements(d) {
    return points(d.achievements.map((a) => a.text).filter(has));
  },

  licences(d, variant) {
    const list = d.licences.filter((l) => has(l.name));
    if (!list.length) return '';

    if (variant === 'side') {
      return '<ul class="cv-side-list">' + list.map((l) => (
        '<li><strong>' + esc(l.name) + '</strong>'
        + (has(l.number) ? '<span>No. ' + esc(l.number) + '</span>' : '')
        + '</li>'
      )).join('') + '</ul>';
    }

    return list.map((l) => (
      '<div class="cv-line">'
      + '<span class="cv-line-main"><strong>' + esc(l.name) + '</strong>'
      + (has(l.authority) ? ' <span class="cv-muted">- ' + esc(l.authority) + '</span>' : '')
      + (has(l.number) ? ' <span class="cv-muted">(No. ' + esc(l.number) + ')</span>' : '')
      + '</span>'
      + (has(l.expiry) ? '<span class="cv-line-meta">Valid to ' + esc(l.expiry) + '</span>' : '')
      + '</div>'
    )).join('');
  },

  publications(d) {
    const list = d.publications.filter((p) => has(p.title));
    if (!list.length) return '';
    return '<ol class="cv-pubs">' + list.map((p) => {
      const link = href(p.link);
      const tail = [
        has(p.venue) ? '<em>' + esc(p.venue) + '</em>' : '',
        has(p.year) ? esc(p.year) : '',
      ].filter(Boolean).join(', ');
      return '<li>' + esc(p.title)
        + (tail ? ' ' + tail + '.' : '')
        + (link ? ' <a class="cv-link" href="' + esc(link) + '">' + esc(p.link) + '</a>' : '')
        + '</li>';
    }).join('') + '</ol>';
  },
};

/* -------------------------------------------------------------- assembly */

function buildSections(d, ids, variant) {
  const out = [];
  for (const id of ids) {
    if (id === 'custom') {
      for (const c of d.custom) {
        const body = points(lines(c.body));
        if (body || has(c.heading)) {
          out.push({ id: 'custom', title: c.heading || 'Additional', body });
        }
      }
      continue;
    }
    const body = BODY[id] ? BODY[id](d, variant) : '';
    if (body) out.push({ id, title: titleFor(d, id), body });
  }
  return out;
}

function wrapSections(list) {
  return list.map((s) => (
    '<section class="cv-section" data-sec="' + esc(s.id) + '">'
    + '<h3 class="cv-h">' + esc(s.title) + '</h3>'
    + '<div class="cv-sec-body">' + s.body + '</div>'
    + '</section>'
  )).join('');
}

export function contactItems(b) {
  return [
    { k: 'email', v: b.email, link: b.email ? 'mailto:' + b.email : '' },
    { k: 'phone', v: b.phone, link: b.phone ? 'tel:' + String(b.phone).replace(/\s+/g, '') : '' },
    { k: 'location', v: b.location, link: '' },
    { k: 'website', v: b.website, link: href(b.website) },
    { k: 'linkedin', v: b.linkedin, link: href(b.linkedin) },
    { k: 'github', v: b.github, link: href(b.github) },
  ].filter((c) => has(c.v));
}

function contactInline(b) {
  const items = contactItems(b);
  if (!items.length) return '';
  return '<div class="cv-contact">' + items.map((c) => (
    c.link
      ? '<a href="' + esc(c.link) + '">' + esc(c.v) + '</a>'
      : '<span>' + esc(c.v) + '</span>'
  )).join('<i class="cv-sep">·</i>') + '</div>';
}

function contactStacked(b) {
  const items = contactItems(b);
  if (!items.length) return '';
  return '<ul class="cv-side-contact">' + items.map((c) => (
    '<li>' + (c.link ? '<a href="' + esc(c.link) + '">' + esc(c.v) + '</a>' : esc(c.v)) + '</li>'
  )).join('') + '</ul>';
}

function photoTag(d, cls) {
  if (!d.settings.showPhoto || !d.basics.photo) return '';
  return '<div class="' + cls + '"><img src="' + esc(d.basics.photo) + '" alt=""></div>';
}

function nameBlock(d) {
  const b = d.basics;
  return '<h1 class="cv-name">' + esc(b.fullName || 'Your Name') + '</h1>'
    + (has(b.headline) ? '<p class="cv-headline">' + esc(b.headline) + '</p>' : '');
}

function singleLayout(d) {
  const order = d.settings.order;
  return '<header class="cv-head">'
    + '<div class="cv-head-main">' + nameBlock(d) + contactInline(d.basics) + '</div>'
    + photoTag(d, 'cv-photo')
    + '</header>'
    + '<div class="cv-body">' + wrapSections(buildSections(d, order, 'main')) + '</div>';
}

function sidebarLayout(d, key) {
  const sideIds = SIDE_SECTIONS[key] || [];
  const order = d.settings.order;
  const inSide = order.filter((id) => sideIds.includes(id));
  const inMain = order.filter((id) => !sideIds.includes(id));

  const side = '<aside class="cv-side">'
    + photoTag(d, 'cv-side-photo')
    + (key === 'modern' ? '<div class="cv-side-name">' + nameBlock(d) + '</div>' : '')
    + '<div class="cv-side-block"><h3 class="cv-h">Contact</h3>' + contactStacked(d.basics) + '</div>'
    + wrapSections(buildSections(d, inSide, 'side'))
    + '</aside>';

  const main = '<div class="cv-main">'
    + wrapSections(buildSections(d, inMain, 'main'))
    + '</div>';

  const banner = key === 'creative'
    ? '<header class="cv-banner">' + nameBlock(d) + '</header>'
    : '';

  return banner + '<div class="cv-split">' + side + main + '</div>';
}

export function renderCV(d) {
  const key = TEMPLATES[d.settings.template] ? d.settings.template : 'classic';
  const t = TEMPLATES[key];
  const html = t.layout === 'sidebar' ? sidebarLayout(d, key) : singleLayout(d);
  const classes = [
    'page',
    'tpl-' + key,
    'font-' + d.settings.font,
    'density-' + d.settings.density,
    'paper-' + d.settings.paper,
    d.settings.uppercaseHeadings ? 'caps-on' : 'caps-off',
  ].join(' ');
  return { html, classes };
}

/* ---------------------------------------------------------- cover letter */

function todayLong() {
  const now = new Date();
  return now.getDate() + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'][now.getMonth()] + ' ' + now.getFullYear();
}

export function letterGreeting(c) {
  const who = String(c.recipient || '').trim();
  if (!who) return 'Dear Hiring Manager,';
  return 'Dear ' + who.replace(/,$/, '') + ',';
}

// The letter shares the CV's page, typeface and accent so the pair look posted
// together - but it is a letter: no sections, no bullets, no columns.
export function renderLetter(d) {
  const c = d.cover || {};
  const b = d.basics;

  const senderLines = contactItems(b).map((x) => esc(x.v));
  const sender = '<div class="lt-sender">'
    + '<h1 class="lt-name">' + esc(b.fullName || 'Your Name') + '</h1>'
    + (has(b.headline) ? '<div class="lt-role">' + esc(b.headline) + '</div>' : '')
    + (senderLines.length
      ? '<div class="lt-contact">' + senderLines.join('<i class="cv-sep">·</i>') + '</div>' : '')
    + '</div>';

  const toBits = [c.recipient, c.recipientTitle, c.company].filter(has).map((x) => esc(x));
  const addr = lines(c.companyAddress).map((l) => esc(l));
  const recipient = (toBits.length || addr.length)
    ? '<div class="lt-to">' + toBits.concat(addr).join('<br>') + '</div>'
    : '';

  const subject = has(c.role)
    ? '<p class="lt-subject">Re: ' + esc(c.role)
      + (has(c.company) ? ' at ' + esc(c.company) : '')
      + (has(c.ref) ? ' (' + esc(c.ref) + ')' : '') + '</p>'
    : '';

  const paras = String(c.body || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const bodyHtml = paras.length
    ? paras.map((p) => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('')
    : '<p class="lt-empty">Your letter goes here. Three or four short paragraphs does the whole job: '
      + 'which role, the most relevant thing you have done with a number attached, why this employer '
      + 'specifically, and a closing line.</p>';

  return '<div class="letter">'
    + sender
    + '<div class="lt-date">' + esc(has(c.date) ? c.date : todayLong()) + '</div>'
    + recipient
    + '<p class="lt-greeting">' + esc(letterGreeting(c)) + '</p>'
    + subject
    + '<div class="lt-body">' + bodyHtml + '</div>'
    + '<div class="lt-sign"><p>' + esc(c.signoff || 'Yours sincerely') + ',</p>'
    + '<p class="lt-signature">' + esc(b.fullName || 'Your Name') + '</p></div>'
    + '</div>';
}

export function renderLetterDoc(d) {
  const key = TEMPLATES[d.settings.template] ? d.settings.template : 'classic';
  const classes = [
    'page', 'page-letter', 'tpl-' + key, 'font-' + d.settings.font,
    'density-' + d.settings.density, 'paper-' + d.settings.paper,
    d.settings.uppercaseHeadings ? 'caps-on' : 'caps-off',
  ].join(' ');
  return { html: renderLetter(d), classes };
}

export function renderLetterText(d) {
  const c = d.cover || {};
  const b = d.basics;
  const out = [b.fullName || 'Your Name'];
  if (has(b.headline)) out.push(b.headline);
  const contact = contactItems(b).map((x) => x.v);
  if (contact.length) out.push(contact.join(' | '));
  out.push('', has(c.date) ? c.date : todayLong(), '');
  [c.recipient, c.recipientTitle, c.company].filter(has).forEach((x) => out.push(x));
  lines(c.companyAddress).forEach((l) => out.push(l));
  out.push('', letterGreeting(c), '');
  if (has(c.role)) {
    out.push('Re: ' + c.role + (has(c.company) ? ' at ' + c.company : '')
      + (has(c.ref) ? ' (' + c.ref + ')' : ''), '');
  }
  String(c.body || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .forEach((p) => out.push(p, ''));
  out.push((c.signoff || 'Yours sincerely') + ',', '', b.fullName || 'Your Name');
  return out.join('\n').trim() + '\n';
}

/* ------------------------------------------------------- plain-text export */

export function renderText(d) {
  const out = [];
  const rule = (s) => {
    out.push('', s.toUpperCase(), '='.repeat(Math.max(s.length, 3)));
  };
  const b = d.basics;

  out.push(b.fullName || 'Your Name');
  if (has(b.headline)) out.push(b.headline);
  const contact = contactItems(b).map((c) => c.v);
  if (contact.length) out.push(contact.join(' | '));

  for (const id of d.settings.order) {
    if (id === 'summary') {
      const s = lines(b.summary);
      if (s.length) { rule(titleFor(d, 'summary')); out.push(...s); }
    } else if (id === 'experience') {
      if (!d.experience.length) continue;
      rule(titleFor(d, 'experience'));
      d.experience.forEach((it) => {
        out.push('', [it.role, it.company].filter(has).join(' - ')
          + (dateRange(it) ? '  (' + dateRange(it) + ')' : ''));
        if (has(it.location)) out.push(it.location);
        lines(it.bullets).forEach((l) => out.push('  - ' + l));
      });
    } else if (id === 'education') {
      if (!d.education.length) continue;
      rule(titleFor(d, 'education'));
      d.education.forEach((it) => {
        out.push('', [it.degree, it.school].filter(has).join(' - ')
          + (dateRange(it) ? '  (' + dateRange(it) + ')' : ''));
        if (has(it.score)) out.push(it.score);
        lines(it.details).forEach((l) => out.push('  - ' + l));
      });
    } else if (id === 'projects') {
      if (!d.projects.length) continue;
      rule(titleFor(d, 'projects'));
      d.projects.forEach((it) => {
        out.push('', [it.name, it.date].filter(has).join('  '));
        if (has(it.tech)) out.push('Tech: ' + it.tech);
        if (has(it.link)) out.push(it.link);
        lines(it.bullets).forEach((l) => out.push('  - ' + l));
      });
    } else if (id === 'skills') {
      if (!d.skills.length) continue;
      rule(titleFor(d, 'skills'));
      d.skills.forEach((g) => out.push([g.group, g.items].filter(has).join(': ')));
    } else if (id === 'certifications') {
      if (!d.certifications.length) continue;
      rule(titleFor(d, 'certifications'));
      d.certifications.forEach((c) => out.push('- ' + [c.name, c.issuer, c.year].filter(has).join(', ')));
    } else if (id === 'licences') {
      const list = d.licences.filter((l) => has(l.name));
      if (!list.length) continue;
      rule(titleFor(d, 'licences'));
      list.forEach((l) => out.push('- ' + [l.name, l.authority, l.number && 'No. ' + l.number,
        l.expiry && 'valid to ' + l.expiry].filter(Boolean).join(', ')));
    } else if (id === 'publications') {
      const list = d.publications.filter((p) => has(p.title));
      if (!list.length) continue;
      rule(titleFor(d, 'publications'));
      list.forEach((p, i) => out.push((i + 1) + '. '
        + [p.title, p.venue, p.year].filter(has).join(', ') + (has(p.link) ? ' ' + p.link : '')));
    } else if (id === 'languages') {
      if (!d.languages.length) continue;
      rule(titleFor(d, 'languages'));
      out.push(d.languages.map((l) => [l.name, l.level].filter(has).join(' (') + (has(l.level) ? ')' : '')).join(', '));
    } else if (id === 'achievements') {
      const a = d.achievements.map((x) => x.text).filter(has);
      if (!a.length) continue;
      rule(titleFor(d, 'achievements'));
      a.forEach((l) => out.push('- ' + l));
    } else if (id === 'custom') {
      d.custom.forEach((c) => {
        const body = lines(c.body);
        if (!body.length && !has(c.heading)) return;
        rule(c.heading || 'Additional');
        body.forEach((l) => out.push('- ' + l));
      });
    }
  }
  return out.join('\n').trim() + '\n';
}
