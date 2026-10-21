// Mini-Webserver zum lokalen Testen: node scripts/serve.mjs, dann http://localhost:8090 öffnen.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { root } from './lib.mjs';

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const port = Number(process.env.PORT) || 8090;

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  if (path.startsWith('..')) { res.writeHead(403); return res.end(); }
  try {
    const file = join(root, path || 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': (TYPES[extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Nicht gefunden');
  }
}).listen(port, () => console.log(`Travelguide läuft auf http://localhost:${port}`));
