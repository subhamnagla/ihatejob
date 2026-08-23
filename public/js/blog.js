// Blog: a listing at /blog and a post at /blog/<slug>, both from posts.json.
//
// The Markdown renderer below is deliberately small. It covers what a post
// actually needs and nothing else, which keeps the site dependency-free - and
// since posts come from the admin rather than from strangers, it escapes first
// and then adds markup, so a post can never inject script.

const $ = (id) => document.getElementById(id);

$('btnTheme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('ihatejob.theme', next); } catch { /* private mode */ }
});

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const niceDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/* ------------------------------------------------------- tiny markdown */

function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\W)\*([^*\n]+)\*/g, '$1<em>$2</em>')
    // Only http(s) and root-relative links; anything else stays as plain text
    // so a post can never produce a javascript: URL.
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
      (m, label, href) => '<a href="' + href + '"'
        + (href.startsWith('http') ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>');
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

/* ----------------------------------------------------------------- views */

function listing(posts) {
  if (!posts.length) {
    return '<header class="blog-head"><h1>Blog</h1>'
      + '<p>Nothing published yet.</p></header>';
  }
  return '<header class="blog-head"><h1>Blog</h1>'
    + '<p>Notes on CVs, hiring conventions, and what actually gets you read.</p></header>'
    + '<div class="post-list">' + posts.map((p) => (
      '<a class="post-card" href="/blog/' + encodeURIComponent(p.slug) + '">'
      + '<span class="post-date">' + esc(niceDate(p.date)) + '</span>'
      + '<h2>' + esc(p.title) + '</h2>'
      + (p.excerpt ? '<p>' + esc(p.excerpt) + '</p>' : '')
      + '<span class="post-go">Read &rarr;</span>'
      + '</a>'
    )).join('') + '</div>';
}

function article(post, all) {
  const idx = all.findIndex((p) => p.slug === post.slug);
  const next = all[idx + 1];
  document.title = post.title + ' - ihatejob';

  return '<article class="post">'
    + '<a class="post-back" href="/blog">&larr; All posts</a>'
    + '<header><span class="post-date">' + esc(niceDate(post.date)) + '</span>'
    + '<h1>' + esc(post.title) + '</h1>'
    + (post.excerpt ? '<p class="post-lede">' + esc(post.excerpt) + '</p>' : '')
    + '</header>'
    + '<div class="post-body">' + markdown(post.body) + '</div>'
    + (next
      ? '<a class="post-next" href="/blog/' + encodeURIComponent(next.slug) + '">'
        + '<span>Next</span><b>' + esc(next.title) + '</b></a>'
      : '')
    + '</article>';
}

function missing() {
  document.title = 'Post not found - ihatejob';
  return '<div class="blog-head"><h1>Not found</h1>'
    + '<p>That post does not exist, or is not published yet.</p>'
    + '<p><a class="btn" href="/blog">All posts</a></p></div>';
}

/* ------------------------------------------------------------------ boot */

(async () => {
  const root = $('blogRoot');
  let posts = [];
  try {
    const res = await fetch('/data/posts.json', { cache: 'no-cache' });
    if (res.ok) posts = await res.json();
  } catch { /* falls through to the empty state */ }

  const live = (Array.isArray(posts) ? posts : [])
    .filter((p) => p.published && p.slug && p.title)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const slug = decodeURIComponent(location.pathname.replace(/^\/blog\/?/, '').replace(/\/$/, ''));
  if (!slug) { root.innerHTML = listing(live); return; }

  const post = live.find((p) => p.slug === slug);
  root.innerHTML = post ? article(post, live) : missing();
})();
