import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const PORT = Number(process.env.PORT) || 5190;

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
    let rel = decodeURIComponent(pathname);
    // "/" is the landing page; "/app" is the builder.
    if (rel === '/app' || rel === '/app/') rel = '/app.html';
    if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
    if (rel === '/blog' || rel.startsWith('/blog/')) rel = '/blog.html';
    if (rel.endsWith('/')) rel += 'index.html';
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
