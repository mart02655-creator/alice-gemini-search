import http from 'node:http';
import alice from './api/alice.js';
import health from './api/health.js';
http.createServer(async (req, res) => {
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!['/api/alice', '/api/health'].includes(path)) return res.status(404).json({ error: 'not_found' });
  let chunks = [], size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) return res.status(413).json({ error: 'body_too_large' });
    chunks.push(chunk);
  }
  req.body = Buffer.concat(chunks).toString();
  await (path === '/api/alice' ? alice : health)(req, res);
}).listen(3000, '127.0.0.1', () => console.log('Local server: http://127.0.0.1:3000/api/health'));
