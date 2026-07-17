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
  kvSelfTest,
} from './translate-core.mjs';
import { datasetNames, getDataset, isDataset } from './exoplanets-core.mjs';
import {
  isCollection,
  normalizeTerm,
  searchTech,
} from './techtransfer-core.mjs';

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
    // ?check=deepl|kv|all → testa de verdade (ver api/health.mjs).
    const check = url.searchParams.get('check');
    if (check) {
      Promise.all([
        check === 'deepl' || check === 'all' ? selfTest() : null,
        check === 'kv' || check === 'all' ? kvSelfTest() : null,
      ]).then(([deeplCheck, kvCheck]) => {
        sendJson(res, 200, {
          ...body,
          ...(deeplCheck ? { check: deeplCheck } : {}),
          ...(kvCheck ? { kvCheck } : {}),
        });
      });
      return;
    }
    sendJson(res, 200, body);
    return;
  }

  // Mesmo contrato da função serverless (api/techtransfer.mjs).
  if (req.method === 'GET' && url.pathname === '/api/techtransfer') {
    const term = normalizeTerm(url.searchParams.get('q'));
    const type = url.searchParams.get('type') ?? 'patent';
    if (!isCollection(type)) {
      sendJson(res, 400, { error: 'colecao_invalida' });
      return;
    }
    if (!term) {
      sendJson(res, 400, { error: 'termo_obrigatorio' });
      return;
    }
    searchTech(type, term)
      .then(({ rows, cache }) =>
        sendJson(res, 200, { type, q: term, count: rows.length, cache, rows }),
      )
      .catch((err) => {
        console.error('techtransfer error:', err.message);
        sendJson(res, err.status ?? 502, {
          error: 'techtransfer_failed',
          upstream: err.upstream ?? null,
          detail: err.detail ?? err.message ?? null,
        });
      });
    return;
  }

  // Mesmo contrato da função serverless (api/exoplanets.mjs).
  if (req.method === 'GET' && url.pathname === '/api/exoplanets') {
    const dataset = url.searchParams.get('dataset') ?? '';
    if (!isDataset(dataset)) {
      sendJson(res, 400, { error: 'dataset_invalido', allowed: datasetNames() });
      return;
    }
    getDataset(dataset)
      .then(({ rows, cache }) =>
        sendJson(res, 200, { dataset, count: rows.length, cache, rows }),
      )
      .catch((err) => {
        console.error('exoplanets error:', err.message);
        sendJson(res, err.status ?? 502, {
          error: 'exoplanets_failed',
          upstream: err.upstream ?? null,
          detail: err.detail ?? err.message ?? null,
        });
      });
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
