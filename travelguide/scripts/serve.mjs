// Mini-Webserver zum lokalen Testen: node scripts/serve.mjs, dann http://localhost:8090 öffnen.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root } from './lib.mjs';

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const port = Number(process.env.PORT) || 8090;

// /api/<name> führt netlify/functions/<name>.mjs aus, so wie später auf Netlify.
// Für Live-Flugpreise vorher die Umgebungsvariable TRAVELPAYOUTS_TOKEN setzen.
async function runFunction(name, req, res) {
  if (!/^[a-z-]+$/.test(name)) { res.writeHead(404); return res.end(); }
  try {
    const mod = await import(pathToFileURL(join(root, '..', 'netlify', 'functions', name + '.mjs')).href);
    const response = await mod.default(new Request(new URL(req.url, 'http://localhost')));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
}

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  if (path.startsWith('..')) { res.writeHead(403); return res.end(); }
  if (path.startsWith('api')) return runFunction(path.slice(4), req, res);
  try {
    const file = join(root, path || 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': (TYPES[extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Nicht gefunden');
  }
}).listen(port, () => console.log(`Travelguide läuft auf http://localhost:${port}`));
