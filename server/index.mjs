/**
 * Proxy de tradução do Galaxy Explorer.
 *
 * Expõe POST /api/translate para o front-end, escondendo a chave do provedor
 * (DeepL por padrão) no servidor e com cache em memória para reduzir custo.
 *
 * Config por variáveis de ambiente:
 *   DEEPL_API_KEY   chave da DeepL (se ausente, ver TRANSLATE_MOCK)
 *   DEEPL_API_URL   endpoint (default: https://api-free.deepl.com/v2/translate)
 *   TRANSLATE_MOCK  =1 → traduções fictícias «texto» (para testes, sem chave)
 *   PORT            porta (default 3001)
 *
 * Sem chave e sem MOCK, devolve o texto original (identidade) — assim o app
 * continua funcionando (mostra o conteúdo em inglês).
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT) || 3001;
const DEEPL_KEY = process.env.DEEPL_API_KEY;
const DEEPL_URL =
  process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate';
const MOCK = process.env.TRANSLATE_MOCK === '1';

/** Cache em memória: `${target}::${text}` → tradução. */
const cache = new Map();

/** Mapeia código curto → código de destino do provedor. */
function targetLang(target) {
  const t = (target || 'pt').toLowerCase();
  if (t === 'pt' || t === 'pt-br') return 'PT-BR';
  return t.toUpperCase();
}

async function deepl(texts, target, source) {
  const params = new URLSearchParams();
  for (const t of texts) params.append('text', t);
  params.append('target_lang', targetLang(target));
  if (source) params.append('source_lang', source.toUpperCase());

  const res = await fetch(DEEPL_URL, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  if (!res.ok) {
    throw new Error(`DeepL respondeu ${res.status}`);
  }
  const data = await res.json();
  return data.translations.map((t) => t.text);
}

/** Traduz um lote, usando cache; retorna array alinhado à entrada. */
async function translateBatch(texts, target, source) {
  const results = new Array(texts.length);
  const missing = [];
  const missingIdx = [];

  texts.forEach((text, i) => {
    const key = `${target}::${text}`;
    if (cache.has(key)) {
      results[i] = cache.get(key);
    } else {
      missing.push(text);
      missingIdx.push(i);
    }
  });

  if (missing.length) {
    let translated;
    if (DEEPL_KEY) {
      translated = await deepl(missing, target, source);
    } else if (MOCK) {
      translated = missing.map((t) => `«${t}»`);
    } else {
      translated = missing; // identidade (sem chave)
    }
    missing.forEach((text, j) => {
      cache.set(`${target}::${text}`, translated[j]);
      results[missingIdx[j]] = translated[j];
    });
  }

  return results;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      provider: DEEPL_KEY ? 'deepl' : MOCK ? 'mock' : 'identity',
      cached: cache.size,
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/translate') {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy(); // limite de segurança
    });
    req.on('end', async () => {
      try {
        const body = JSON.parse(raw || '{}');
        const texts = Array.isArray(body.q) ? body.q : [body.q];
        const target = body.target || 'pt';
        const source = body.source || 'en';
        const clean = texts.filter((t) => typeof t === 'string');
        const translations = await translateBatch(clean, target, source);
        sendJson(res, 200, { translations });
      } catch (err) {
        console.error('translate error:', err.message);
        sendJson(res, 502, { error: 'translation_failed' });
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  const mode = DEEPL_KEY ? 'DeepL' : MOCK ? 'MOCK' : 'identidade (sem chave)';
  console.log(`🌐 Translate proxy em http://localhost:${PORT} — modo: ${mode}`);
});
