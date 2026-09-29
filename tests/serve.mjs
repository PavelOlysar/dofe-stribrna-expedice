// Tiny static server for the built site that behaves like GitHub Pages: the site lives under
// PATH_PREFIX (default "/"), folders serve index.html, and unknown paths get 404.html with status 404.
// Usage: node tests/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const port = +(process.argv[2] || process.env.PORT || 8080);
const prefix = process.env.PATH_PREFIX || '/';
const dir = path.resolve('_site');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json' };

const send = (res, file, status = 200) => {
  res.writeHead(status, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
};

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const notFound = () => send(res, path.join(dir, '404.html'), 404);
  if (!url.startsWith(prefix)) return notFound();
  let file = path.join(dir, url.slice(prefix.length));
  if (!file.startsWith(dir)) return notFound();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!url.endsWith('/')) { res.writeHead(301, { Location: url + '/' }); return res.end(); }
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) return notFound();
  send(res, file);
}).listen(port, () => console.log(`Serving _site at http://localhost:${port}${prefix}`));
