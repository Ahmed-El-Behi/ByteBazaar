// Sert le build de production (dist/frontend/browser) et relaie /api vers l'API NestJS.
// Usage : npm run build && npm run serve   (PORT=4300, API_TARGET=http://localhost:3000 par défaut)
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { request, createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const ROOT = resolve(fileURLToPath(new URL('../dist/frontend/browser', import.meta.url)));
const PORT = Number(process.env.PORT ?? 4300);
const API = new URL(process.env.API_TARGET ?? 'http://localhost:3000');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);
// Fichiers du build nommés avec une empreinte (main-AB12CD34.js) : contenu immuable
const HASHED = /-[A-Z0-9]{8}\.(js|css)$/;

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(`Build introuvable dans ${ROOT} : lancer d'abord « npm run build ».`);
  process.exit(1);
}

function proxy(req, res) {
  const upstream = request(
    {
      hostname: API.hostname,
      port: API.port,
      method: req.method,
      path: req.url.replace(/^\/api/, '') || '/',
      headers: {
        ...req.headers,
        host: API.host,
        // Adresse du visiteur ajoutée à la chaîne, comme tout reverse proxy (limites par IP de l'API)
        'x-forwarded-for': [req.headers['x-forwarded-for'], req.socket.remoteAddress]
          .filter(Boolean)
          .join(', '),
      },
    },
    (apiRes) => {
      res.writeHead(apiRes.statusCode ?? 502, apiRes.headers);
      apiRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'API indisponible' }));
  });
  req.pipe(upstream);
}

function resolveFile(urlPath) {
  const path = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT)) return null;
  if (existsSync(file) && statSync(file).isFile()) return file;
  // Route de l'application (/produits/…) : index.html ; fichier manquant (/x.js) : 404
  return extname(path) ? null : join(ROOT, 'index.html');
}

// Versions compressées gardées en mémoire :
// chaque fichier n'est compressé qu'une fois, au niveau maximal, puis servi immédiatement
const compressed = new Map();
function compressedBody(file, encoding) {
  // La date de modification fait partie de la clé : un nouveau build remplace l'ancienne version
  const key = `${encoding}:${file}:${statSync(file).mtimeMs}`;
  let body = compressed.get(key);
  if (!body) {
    const raw = readFileSync(file);
    body =
      encoding === 'br'
        ? brotliCompressSync(raw, {
            params: {
              [constants.BROTLI_PARAM_QUALITY]: 11,
              [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
            },
          })
        : gzipSync(raw, { level: 9 });
    compressed.set(key, body);
  }
  return body;
}

function serveFile(req, res) {
  const file = resolveFile(new URL(req.url, 'http://x').pathname);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Introuvable');
  }
  const ext = extname(file).toLowerCase();
  const headers = {
    'content-type': TYPES[ext] ?? 'application/octet-stream',
    'cache-control': HASHED.test(file)
      ? 'public, max-age=31536000, immutable'
      : ext === '.html'
        ? 'no-cache'
        : 'public, max-age=86400',
    vary: 'accept-encoding',
  };
  const accept = String(req.headers['accept-encoding'] ?? '');
  const encoding = !COMPRESSIBLE.has(ext)
    ? null
    : /\bbr\b/.test(accept)
      ? 'br'
      : /\bgzip\b/.test(accept)
        ? 'gzip'
        : null;
  if (encoding) {
    const body = compressedBody(file, encoding);
    headers['content-encoding'] = encoding;
    headers['content-length'] = body.length;
    res.writeHead(200, headers);
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  headers['content-length'] = statSync(file).size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

// Compression des scripts et styles dès le démarrage : aucune attente à la première visite
function warmUp(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) warmUp(path);
    else if (['.js', '.css', '.html'].includes(extname(entry.name))) {
      compressedBody(path, 'br');
      compressedBody(path, 'gzip');
    }
  }
}

const started = Date.now();
warmUp(ROOT);
console.log(`Fichiers compressés en ${Date.now() - started} ms`);

createServer((req, res) => {
  if (req.url === '/api' || req.url.startsWith('/api/')) return proxy(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }
  serveFile(req, res);
}).listen(PORT, () => {
  console.log(`ByteBazaar : http://localhost:${PORT}  (API relayée vers ${API.origin})`);
});
