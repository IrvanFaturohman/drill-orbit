/* Dev server with caching turned OFF.  Run: node serve.mjs  ->  http://localhost:8000
   `python3 -m http.server` sends no Cache-Control at all, so browsers fall back to
   heuristic caching and keep serving stale js/*.js after an edit. That cost a round of
   "the button isn't there" when the file on disk was correct all along. Zero deps.     */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { networkInterfaces } from 'node:os';

const ROOT = process.cwd();
const PORT = Number(process.argv[2]) || 8000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  /* keep the request inside ROOT: normalize, then reject anything that climbs out */
  const path = join(ROOT, normalize(rel));
  if (path !== ROOT && !path.startsWith(ROOT + sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const info = await stat(path);
    if (info.isDirectory()) throw new Error('dir');
    const body = await readFile(path);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream',
      /* the whole point of this file */
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404 ' + rel);
  }
}).listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
  console.log(`drill-orbit dev server (no cache)`);
  console.log(`  http://localhost:${PORT}`);
  for (const ip of lan) console.log(`  http://${ip}:${PORT}   <- phone, same wifi`);
});
