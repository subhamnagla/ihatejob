// Job journeys: what visitors went through, start to finish.
//
// A story is written by the person who lived it, sent as a GitHub issue, and
// published from the admin - so nothing appears here that was not moderated
// first. Once published, the issue stays the story's discussion thread: the
// likes and comments below are the real reactions and replies on it, read from
// the public GitHub API. That is the whole backend. Nothing is invented, and
// there is no counter for anyone to inflate.
//
// The Markdown renderer is deliberately small and escapes before it adds any
// markup, which matters more here than on a blog: comment bodies come from
// strangers.

import { SITE } from './config.js';

const $ = (id) => document.getElementById(id);

// When the page opened. The submit endpoint rejects anything sent within a
// few seconds of it, which no person manages and every bot does.
const OPENED_AT = Date.now();

$('btnTheme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('ihatejob.theme', next); } catch { /* private mode */ }
});

let toastTimer = 0;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const niceDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const initials = (name) => String(name || '?')
  .replace(/[^\p{L}\s]/gu, '')
  .trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('')
  .toUpperCase() || '?';

const avatarHue = (name) => {
  let h = 0;
  for (let i = 0; i < String(name).length; i += 1) h = (h * 31 + String(name).charCodeAt(i)) % 360;
  return h;
};

/* ------------------------------------------------------- tiny markdown */

function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\W)\*([^*\n]+)\*/g, '$1<em>$2</em>')
    // Only http(s) and root-relative links; anything else stays as plain text
    // so a story - or a stranger's comment - can never produce a javascript: URL.
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
      (m, label, href) => '<a href="' + href + '"'
        + (href.startsWith('http') ? ' target="_blank" rel="noopener nofollow ugc"' : '') + '>' + label + '</a>');
}

function markdown(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  const out = [];
  let list = null;
  let code = false;
  let para = [];

  const flushPara = () => {
    if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; }
  };
  const flushList = () => {
    if (list) { out.push('</' + list + '>'); list = null; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^```/.test(line)) {
      flushPara(); flushList();
      out.push(code ? '</code></pre>' : '<pre><code>');
      code = !code;
      continue;
    }
    if (code) { out.push(esc(raw) + '\n'); continue; }

    if (!line.trim()) { flushPara(); flushList(); continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushPara(); flushList();
      const level = Math.min(h[1].length + 1, 5);   // never emit a second <h1>
      out.push('<h' + level + '>' + inline(h[2]) + '</h' + level + '>');
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara(); flushList();
      out.push('<blockquote>' + inline(line.replace(/^>\s?/, '')) + '</blockquote>');
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line)) { flushPara(); flushList(); out.push('<hr>'); continue; }

    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const want = ul ? 'ul' : 'ol';
      if (list !== want) { flushList(); out.push('<' + want + '>'); list = want; }
      out.push('<li>' + inline((ul || ol)[1]) + '</li>');
      continue;
    }

    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  if (code) out.push('</code></pre>');
  return out.join('\n');
}

/* ------------------------------------------------------------- GitHub */

const REPO_MATCH = String(SITE.repo || '').match(/github\.com\/([^/]+)\/([^/.]+)/);
const OWNER = REPO_MATCH ? REPO_MATCH[1] : '';
const REPO = REPO_MATCH ? REPO_MATCH[2] : '';
const REPO_READY = Boolean(OWNER && REPO && !/your-username/.test(OWNER));

const issueUrl = (n) => 'https://github.com/' + OWNER + '/' + REPO + '/issues/' + n;

// One request returns every story issue with its reaction and comment counts,
// which is what keeps the listing inside GitHub's 60-an-hour public limit.
async function loadCounts() {
  if (!REPO_READY) return {};
  try {
    const res = await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO
      + '/issues?labels=story&state=all&per_page=100');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
    const by = {};
    raw.forEach((i) => {
      by[i.number] = {
        likes: (i.reactions && (i.reactions['+1'] || 0) + (i.reactions.heart || 0)) || 0,
        comments: i.comments || 0,
      };
    });
    return by;
  } catch (err) {
    // Rate limited or offline: the page simply shows no counts rather than
    // showing zero, which would be a different and wrong claim.
    console.info('[ihatejob] Reaction counts unavailable:', err.message);
    return {};
  }
}

async function loadComments(number) {
  const res = await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO
    + '/issues/' + number + '/comments?per_page=50');
  if (!res.ok) throw new Error(res.status === 403
    ? 'GitHub is rate limiting this address - try again in an hour'
    : 'GitHub returned ' + res.status);
  return res.json();
}

/* -------------------------------------------------------------- pieces */

const ICON = {
  like: 'M2 21h4V9H2v12zM23 10a2 2 0 0 0-2-2h-6.3l.95-4.57.03-.32a1.5 1.5 0 0 0-.44-1.06L14.17 1 7.6 7.59A2 2 0 0 0 7 9v10a2 2 0 0 0 2 2h9a2 2 0 0 0 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z',
  comment: 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z',
  share: 'M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1L8.7 8.6a3 3 0 1 0 0 6.8l6.47 3.6A3 3 0 1 0 18 16a3 3 0 0 0-2.13.9L9.4 13.3a3 3 0 0 0 0-2.6L15.87 7.1A3 3 0 0 0 18 8z',
};
const svg = (key, size) => '<svg viewBox="0 0 24 24" width="' + (size || 15) + '" height="'
  + (size || 15) + '" fill="currentColor" aria-hidden="true"><path d="' + ICON[key] + '"/></svg>';

function counts(story, meta) {
  const c = meta[story.issue];
  if (!story.issue || !c) return '';
  return '<span class="st-count">' + svg('like', 14) + c.likes + '</span>'
    + '<span class="st-count">' + svg('comment', 14) + c.comments + '</span>';
}

function byline(story, cls) {
  const who = [story.role, story.place].filter(Boolean).join(' · ');
  return '<div class="' + (cls || 'st-by') + '">'
    + '<span class="rv-avatar" style="--hue:' + avatarHue(story.name || '') + '">'
    + esc(initials(story.name)) + '</span>'
    + '<span class="rv-who"><b>' + esc(story.name || 'Anonymous') + '</b>'
    + '<span>' + esc(who) + '</span></span></div>';
}

/* ------------------------------------------------------------- listing */

function listing(stories, meta) {
  const head = '<header class="blog-head"><h1>Job journeys</h1>'
    + '<p>Real hunts, start to finish, written by the people who lived them &mdash; how long it '
    + 'took, what actually got a reply, and what they would do differently.</p>'
    + '<p><a class="btn btn-primary btn-lg" href="#share-yours">Share your journey</a></p>'
    + '</header>';

  if (!stories.length) {
    return head
      + '<div class="st-empty"><b>No journeys published yet.</b>'
      + '<p>This fills up with real ones or it stays empty. Nothing here is written by us.</p>'
      + '</div>' + shareForm();
  }

  return head + '<div class="post-list">' + stories.map((s) => (
    '<a class="post-card st-card" href="/stories/' + encodeURIComponent(s.slug) + '">'
    + (s.outcome ? '<span class="st-outcome">' + esc(s.outcome) + '</span>' : '')
    + '<span class="post-date">' + esc(niceDate(s.date)) + '</span>'
    + '<h2>' + esc(s.title) + '</h2>'
    + (s.excerpt ? '<p>' + esc(s.excerpt) + '</p>' : '')
    + byline(s)
    + '<span class="st-foot">' + counts(s, meta) + '<span class="post-go">Read &rarr;</span></span>'
    + '</a>'
  )).join('') + '</div>' + shareForm();
}

/* --------------------------------------------------------------- story */

function article(story, all, meta) {
  const idx = all.findIndex((s) => s.slug === story.slug);
  const next = all[idx + 1] || all[idx - 1];
  document.title = story.title + ' - ihatejob';

  const url = SITE.url + '/stories/' + encodeURIComponent(story.slug);
  const text = story.title + ' - a job journey on ihatejob';

  return '<article class="post st-post">'
    + '<a class="post-back" href="/stories">&larr; All journeys</a>'
    + '<header>'
    + (story.outcome ? '<span class="st-outcome">' + esc(story.outcome) + '</span>' : '')
    + '<span class="post-date">' + esc(niceDate(story.date)) + '</span>'
    + '<h1>' + esc(story.title) + '</h1>'
    + (story.excerpt ? '<p class="post-lede">' + esc(story.excerpt) + '</p>' : '')
    + byline(story, 'st-by st-by-lg')
    + '</header>'
    + '<div class="post-body">' + markdown(story.body) + '</div>'

    + '<div class="st-actions">'
    + (story.issue
      ? '<a class="btn st-like" href="' + esc(issueUrl(story.issue)) + '" target="_blank"'
        + ' rel="noopener">' + svg('like') + '<span>Like</span>'
        + (meta[story.issue] ? '<i>' + meta[story.issue].likes + '</i>' : '') + '</a>'
      : '')
    + '<button class="btn st-share" type="button" data-share'
    + ' data-url="' + esc(url) + '" data-text="' + esc(text) + '">'
    + svg('share') + '<span>Share</span></button>'
    + '</div>'

    + (story.issue
      ? '<section class="st-comments" id="comments">'
        + '<h2>Replies</h2>'
        + '<p class="st-note">These are the replies on this journey&rsquo;s GitHub thread, shown as '
        + 'written. They are other visitors&rsquo; words, not ours.</p>'
        + '<div id="commentList"><p class="st-note">Loading&hellip;</p></div>'
        + '<a class="btn btn-primary" href="' + esc(issueUrl(story.issue)) + '#new_comment_field"'
        + ' target="_blank" rel="noopener">Add a reply on GitHub</a>'
        + '</section>'
      : '')

    + (next
      ? '<a class="post-next" href="/stories/' + encodeURIComponent(next.slug) + '">'
        + '<span>Another journey</span><b>' + esc(next.title) + '</b></a>'
      : '')
    + '</article>';
}

async function fillComments(number) {
  const box = $('commentList');
  if (!box) return;
  try {
    const items = await loadComments(number);
    if (!items.length) {
      box.innerHTML = '<p class="st-note">No replies yet. Be the first.</p>';
      return;
    }
    box.innerHTML = items.map((c) => (
      '<article class="st-comment">'
      + '<header>'
      + '<span class="rv-avatar" style="--hue:' + avatarHue(c.user?.login || '') + '">'
      + esc(initials(c.user?.login)) + '</span>'
      + '<b>' + esc(c.user?.login || 'someone') + '</b>'
      + '<span>' + esc(niceDate(c.created_at)) + '</span>'
      + '</header>'
      + '<div class="st-comment-body">' + markdown(c.body) + '</div>'
      + '</article>'
    )).join('');
  } catch (err) {
    box.innerHTML = '<p class="st-note">Could not load the replies: ' + esc(err.message)
      + '. They are all on <a href="' + esc(issueUrl(number)) + '" target="_blank"'
      + ' rel="noopener">the thread itself</a>.</p>';
  }
}

/* ------------------------------------------------------- share yours */

function shareForm() {
  return '<section class="rv-form st-form" id="share-yours">'
    + '<h2>Share your journey</h2>'
    + '<p class="section-lede">However it went. The ones that took eleven months and forty '
    + 'rejections are worth more to the next person than the ones that took a fortnight.</p>'
    + '<div class="grid">'
    + '<div class="field s6"><label for="syTitle">Headline</label>'
    + '<input class="input" id="syTitle" type="text"'
    + ' placeholder="e.g. Four months, 62 applications, one yes"></div>'
    + '<div class="field s6"><label for="syOutcome">How it ended '
    + '<span class="opt">optional</span></label>'
    + '<input class="input" id="syOutcome" type="text" placeholder="e.g. Offer at an NHS trust"></div>'
    + '<div class="field s6"><label for="syName">Your name <span class="opt">optional</span></label>'
    + '<input class="input" id="syName" type="text" autocomplete="name"'
    + ' placeholder="However you want to be credited"></div>'
    + '<div class="field s6"><label for="syRole">What you do '
    + '<span class="opt">optional</span></label>'
    + '<input class="input" id="syRole" type="text" placeholder="e.g. Staff nurse, Leeds"></div>'
    + '<div class="field"><label for="syBody">The journey</label>'
    + '<textarea class="input" id="syBody" rows="8"'
    + ' placeholder="Where you started, what you tried, what did nothing, what finally worked, '
    + 'and how long the whole thing took. The dull middle is the useful part."></textarea></div>'
    + '</div>'
    + '<div class="hp" aria-hidden="true"><label for="syWebsite">Website</label>'
    + '<input id="syWebsite" type="text" tabindex="-1" autocomplete="off"></div>'
    + '<label class="check rv-consent"><input type="checkbox" id="syConsent" checked>'
    + '<span>You may publish this on the site, with the credit above.</span></label>'
    + '<div class="suggest-actions">'
    + '<button class="btn btn-primary" type="button" id="sySend">Send my journey</button>'
    + '<button class="btn" type="button" id="syCopy">Copy instead</button>'
    + '<span class="hint" id="syNote" style="margin:0"></span>'
    + '</div>'
    + '<p class="rv-fineprint">No account needed. It reaches us directly and becomes the thread '
    + 'other people reply on. Published as written &mdash; nothing is edited into a happy ending.</p>'
    + '</section>';
}

function storyText() {
  const credit = [$('syName').value.trim(), $('syRole').value.trim()].filter(Boolean).join(' - ');
  return [
    'Outcome: ' + ($('syOutcome').value.trim() || 'not said'),
    'Credit: ' + (credit || 'anonymous'),
    'May be published on the site: ' + ($('syConsent').checked ? 'yes' : 'no'),
    '',
    $('syBody').value.trim(),
  ].join('\n');
}

function storyReady() {
  if (!$('syTitle').value.trim()) {
    $('syNote').textContent = 'Give it a headline first.';
    $('syTitle').focus();
    return false;
  }
  if ($('syBody').value.trim().length < 40) {
    $('syNote').textContent = 'Tell us a bit more - a line or two is not a journey.';
    $('syBody').focus();
    return false;
  }
  $('syNote').textContent = '';
  return true;
}

function wireShareForm() {
  const send = $('sySend');
  if (!send) return;

  send.addEventListener('click', async () => {
    if (!storyReady()) return;
    send.disabled = true;
    $('syNote').textContent = 'Sending…';

    // Straight to us, with no account. A journey is a long thing to write; being
    // asked to register with GitHub at the end of it would waste the effort.
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'story',
          title: $('syTitle').value.trim(),
          body: storyText(),
          website: $('syWebsite').value,
          startedAt: OPENED_AT,
        }),
      });
      const type = res.headers.get('content-type') || '';
      if (type.includes('application/json')) {
        const out = await res.json();
        if (res.ok && out.ok) {
          $('syNote').textContent = '';
          $('sySend').closest('.st-form').querySelectorAll('.input').forEach((i) => { i.value = ''; });
          toast('Sent. Thank you - it reaches us directly, no account needed.');
          send.disabled = false;
          return;
        }
        if (res.status !== 503) {
          $('syNote').textContent = out.error || 'That could not be sent.';
          send.disabled = false;
          return;
        }
      }
    } catch { /* offline or not deployed - fall through */ }

    // No GitHub fallback here on purpose. Someone who has just written up their
    // whole job hunt should not be handed a sign-up page at the end of it.
    send.disabled = false;
    $('syNote').textContent = 'Sending is not set up here yet - use Copy instead.';
  });

  $('syCopy').addEventListener('click', async () => {
    if (!storyReady()) return;
    try {
      await navigator.clipboard.writeText($('syTitle').value.trim() + '\n\n' + storyText());
      toast('Copied. Paste it wherever suits you.');
    } catch {
      $('syNote').textContent = 'Could not copy - select the text and copy it manually.';
    }
  });
}

/* ------------------------------------------------------------ mobile nav */

const navSheet = $('navSheet');
const navToggle = $('navToggle');
const setNav = (open) => {
  navSheet.hidden = !open;
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
};
navToggle.addEventListener('click', () => setNav(navSheet.hidden));
navSheet.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
document.addEventListener('click', (e) => {
  if (!navSheet.hidden && !e.target.closest('#navSheet, #navToggle')) setNav(false);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

/* ------------------------------------------------------------------ boot */

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-share]');
  if (!btn) return;
  const { url, text } = btn.dataset;
  if (navigator.share) {
    try { await navigator.share({ title: 'ihatejob', text, url }); return; } catch { return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied.');
  } catch {
    toast(url);
  }
});

(async () => {
  const root = $('storyRoot');
  let stories = [];
  try {
    const res = await fetch('/data/stories.json', { cache: 'no-cache' });
    if (res.ok) stories = await res.json();
  } catch { /* falls through to the empty state */ }

  const live = (Array.isArray(stories) ? stories : [])
    .filter((s) => s.published && s.slug && s.title)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const slug = decodeURIComponent(location.pathname.replace(/^\/stories\/?/, '').replace(/\/$/, ''));
  const meta = await loadCounts();

  if (!slug) {
    root.innerHTML = listing(live, meta);
    wireShareForm();
    return;
  }

  const story = live.find((s) => s.slug === slug);
  if (!story) {
    document.title = 'Journey not found - ihatejob';
    root.innerHTML = '<div class="blog-head"><h1>Not found</h1>'
      + '<p>That journey does not exist, or is not published yet.</p>'
      + '<p><a class="btn" href="/stories">All journeys</a></p></div>';
    return;
  }

  root.innerHTML = article(story, live, meta);
  if (story.issue) fillComments(story.issue);
})();

import('./pwa.js').then(({ initPWA }) => initPWA({ onToast: toast }));
