// Edge middleware: the only place admin access can actually be enforced.
//
// A password checked in browser JavaScript is not a password - it ships to
// every visitor in a file they can open. This runs on Vercel's edge before any
// file is served, so the credentials never leave the server.
//
// Required environment variables (Vercel -> Settings -> Environment Variables):
//   ADMIN_USER      the username
//   ADMIN_PASSWORD  the password
//   ADMIN_PATH      optional: the secret address, e.g. /control-room-7f3a
//
// With no password set the admin is sealed shut rather than left open. An
// admin panel that is accidentally public is worse than one that is broken.

export const config = {
  matcher: ['/admin', '/admin.html', '/admin/:path*', '/api/content'],
};

function unauthorised(message) {
  return new Response(message || 'Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="ihatejob admin", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function notFound() {
  // A wrong address should look like nothing is there, not like something
  // guarded - that only tells a stranger where to keep trying.
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Compare in constant time so a wrong password cannot be found one character
// at a time by measuring how long the answer takes.
function safeEqual(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export default function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  const USER = process.env.ADMIN_USER || '';
  const PASS = process.env.ADMIN_PASSWORD || '';
  const SECRET_PATH = (process.env.ADMIN_PATH || '').replace(/\/+$/, '');

  const isApi = path === '/api/content';

  // When a secret address is set, the default ones stop existing entirely.
  if (!isApi && SECRET_PATH && path !== SECRET_PATH) return notFound();

  if (!USER || !PASS) {
    return new Response(
      'Admin is disabled: ADMIN_USER and ADMIN_PASSWORD are not set on this deployment.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  const header = request.headers.get('authorization') || '';
  if (!header.toLowerCase().startsWith('basic ')) return unauthorised();

  let decoded = '';
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return unauthorised('Malformed credentials');
  }

  const at = decoded.indexOf(':');
  const user = at === -1 ? decoded : decoded.slice(0, at);
  const pass = at === -1 ? '' : decoded.slice(at + 1);

  // Evaluate both so the reply takes the same time whichever half is wrong.
  const okUser = safeEqual(user, USER);
  const okPass = safeEqual(pass, PASS);
  if (!(okUser && okPass)) return unauthorised('Wrong username or password');

  // Authenticated. Serve the page from its real file, and never let it cache.
  if (isApi) return undefined;

  const rewritten = new URL('/admin.html', request.url);
  return new Response(null, {
    status: 200,
    headers: {
      'x-middleware-rewrite': rewritten.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
