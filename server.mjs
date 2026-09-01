import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import submit from './api/submit.js';
import content from './api/content.js';
import approve from './api/approve.js';
import vote from './api/vote.js';
import votesReport from './api/votes-report.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const PORT = Number(process.env.PORT) || 5190;

// The API is routed here rather than left to Vercel's /api auto-detection.
// Vercel builds this file as the project's single entrypoint, and in that mode
// the api/ directory is never turned into separate functions - the deployment
// carried exactly two lambdas, this one and the middleware, so every /api/*
// request was falling through to the static handler and being answered with
// index.html. Importing the handlers means one code path that works in
// production and in `npm run dev` alike.
const API = {
  '/api/submit': submit,
  '/api/content': content,
  '/api/vote': vote,
  // In production middleware.js puts the admin password in front of these two.
  '/api/approve': approve,
  '/api/votes-report': votesReport,
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');

    const api = API[pathname];
    if (api) {
      await api(req, res);
      return;
    }

    let rel = decodeURIComponent(pathname);
    // "/" is the landing page; "/app" is the builder.
    if (rel === '/app' || rel === '/app/') rel = '/app.html';
    if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
    // /blog was the old name for this section. Keep existing links working.
    if (rel === '/blog' || rel.startsWith('/blog/')) {
      res.writeHead(301, { Location: '/stories' });
      res.end();
      return;
    }
    if (rel === '/stories' || rel.startsWith('/stories/')) rel = '/stories.html';
    if (rel.endsWith('/')) rel += 'index.html';
    // Vercel serves these with cleanUrls; this is the same rule locally, so
    // /cv/nursing resolves to the generated file in dev as well as production.
    if (!extname(rel)) {
      const asHtml = join(ROOT, normalize(rel + '.html'));
      if (await stat(asHtml).then((s) => s.isFile()).catch(() => false)) rel += '.html';
    }
    // join + the prefix check below is what actually contains traversal
    const file = join(ROOT, normalize(rel));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const info = await stat(file).catch(() => null);
    // Unknown paths fall back to the landing page, not the builder.
    const target = info && info.isFile() ? file : join(ROOT, 'index.html');
    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      // A stale service worker pins a stale app, so it must never be cached.
      ...(target.endsWith('sw.js') ? { 'Service-Worker-Allowed': '/' } : {}),
    });
    res.end(body);
  } catch {
    res.writeHead(500).end('Server error');
  }
}).listen(PORT, () => {
  console.log(`ihatejob running at http://localhost:${PORT}`);
});
