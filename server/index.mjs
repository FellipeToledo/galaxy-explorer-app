/**
 * Servidor de tradução para DESENVOLVIMENTO LOCAL (Node puro, sem deps).
 * Em produção na Vercel, a mesma lógica roda como função serverless em
 * api/translate.mjs — ambos usam server/translate-core.mjs.
 *
 * Expõe POST /api/translate e GET /api/health. Config via env
 * (DEEPL_API_KEY, DEEPL_API_URL, TRANSLATE_MOCK, PORT, e o par KV_REST_API_*
 * do cache durável). Veja translate-core.mjs.
 */
import { createServer } from 'node:http';
import {
  translateBatch,
  providerName,
  cacheSize,
  cacheBackend,
  providerDiagnostics,
  selfTest,
} from './translate-core.mjs';

const PORT = Number(process.env.PORT) || 3001;

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    const body = {
      ok: true,
      provider: providerName(),
      cached: cacheSize(),
      cache: cacheBackend(),
      deepl: providerDiagnostics(),
    };
    // ?check=deepl → bate na API de verdade (ver api/health.mjs).
    if (url.searchParams.get('check') === 'deepl') {
      selfTest().then((check) => sendJson(res, 200, { ...body, check }));
      return;
    }
    sendJson(res, 200, body);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/translate') {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on('end', async () => {
      try {
        const body = JSON.parse(raw || '{}');
        const texts = Array.isArray(body.q) ? body.q : [body.q];
        const clean = texts.filter((t) => typeof t === 'string');
        const translations = await translateBatch(
          clean,
          body.target || 'pt',
          body.source || 'en',
        );
        sendJson(res, 200, { translations });
      } catch (err) {
        console.error('translate error:', err.message);
        sendJson(res, 502, {
          error: 'translation_failed',
          upstream: err.status ?? null,
          detail: err.detail ?? err.message ?? null,
        });
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  console.log(
    `🌐 Translate proxy em http://localhost:${PORT} — modo: ${providerName()}`,
  );
});
