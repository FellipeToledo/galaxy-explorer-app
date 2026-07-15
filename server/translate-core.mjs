/**
 * Núcleo de tradução compartilhado pelo servidor local (server/index.mjs) e
 * pela função serverless da Vercel (api/translate.mjs).
 *
 * Cache em duas camadas:
 *   L1 memória — instantânea, mas some no cold start do serverless;
 *   L2 KV      — durável e opcional (ver server/kv-cache.mjs). Sem KV
 *                configurado, só a L1 vale e o comportamento é o de antes.
 *
 * Config por variáveis de ambiente:
 *   DEEPL_API_KEY   chave da DeepL (ausente → ver TRANSLATE_MOCK)
 *   DEEPL_API_URL   endpoint (default: https://api-free.deepl.com/v2/translate)
 *   TRANSLATE_MOCK  =1 → traduções fictícias «texto» (testes, sem chave)
 *   KV_REST_API_URL / KV_REST_API_TOKEN  → liga o cache durável
 *
 * Sem chave e sem MOCK, devolve o texto original (identidade).
 */
import { cacheKey, kvEnabled, kvGetMany, kvSetMany } from './kv-cache.mjs';

/** Cache L1, em memória (persiste em instâncias "quentes" do serverless). */
const cache = new Map();

export function providerName() {
  if (process.env.DEEPL_API_KEY) return 'deepl';
  if (process.env.TRANSLATE_MOCK === '1') return 'mock';
  return 'identity';
}

export function cacheSize() {
  return cache.size;
}

/** Camadas de cache ativas — aparece no /api/health. */
export function cacheBackend() {
  return kvEnabled() ? 'memory+kv' : 'memory';
}

function targetLang(target) {
  const t = (target || 'pt').toLowerCase();
  if (t === 'pt' || t === 'pt-br') return 'PT-BR';
  return t.toUpperCase();
}

const DEEPL_FREE = 'https://api-free.deepl.com/v2/translate';
const DEEPL_PRO = 'https://api.deepl.com/v2/translate';

/** Chaves da conta Free terminam em `:fx` — é como a própria DeepL distingue. */
function isFreeKey(key) {
  return (key || '').trim().endsWith(':fx');
}

/**
 * Endpoint do DeepL.
 *
 * Free e Pro têm hosts DIFERENTES e usar o host errado devolve 403 — erro que
 * parece "chave inválida" e já custou uma sessão de debug. Então o host é
 * derivado do tipo da chave, a menos que DEEPL_API_URL diga o contrário.
 */
export function deeplEndpoint() {
  const explicit = process.env.DEEPL_API_URL?.trim();
  if (explicit) {
    return explicit;
  }
  return isFreeKey(process.env.DEEPL_API_KEY) ? DEEPL_FREE : DEEPL_PRO;
}

async function deepl(texts, target, source) {
  const url = deeplEndpoint();
  const params = new URLSearchParams();
  for (const t of texts) params.append('text', t);
  params.append('target_lang', targetLang(target));
  if (source) params.append('source_lang', source.toUpperCase());

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  if (!res.ok) {
    // O motivo real vem no corpo ("Forbidden", "Quota exceeded"…). Sem ele, o
    // 502 genérico não diz nada. O corpo do DeepL não contém a chave.
    const body = await res.text().catch(() => '');
    let detail = body.slice(0, 200);
    try {
      detail = JSON.parse(body).message ?? detail;
    } catch {
      // corpo não-JSON: usa o texto cru
    }
    const err = new Error(`DeepL respondeu ${res.status}: ${detail}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  const data = await res.json();
  return data.translations.map((t) => t.text);
}

/**
 * Diagnóstico do provider, sem expor a chave — só o formato dela.
 * Serve para pegar de longe o descasamento chave×host.
 */
export function providerDiagnostics() {
  const key = process.env.DEEPL_API_KEY?.trim();
  if (!key) {
    return { keyPresent: false };
  }
  const host = new URL(deeplEndpoint()).host;
  const expected = isFreeKey(key) ? 'api-free.deepl.com' : 'api.deepl.com';
  return {
    keyPresent: true,
    keyKind: isFreeKey(key) ? 'free' : 'pro',
    host,
    // false aqui = 403 na certa.
    endpointMatchesKey: host === expected,
    urlOverridden: Boolean(process.env.DEEPL_API_URL?.trim()),
  };
}

/**
 * Bate no DeepL de verdade e devolve o status — o teste que o /api/health
 * sozinho não faz (ele só diz que a env var existe). Não usa cache, senão
 * testaria a memória em vez da API.
 */
export async function selfTest() {
  if (providerName() !== 'deepl') {
    return { ok: false, reason: `provider é "${providerName()}", não deepl` };
  }
  try {
    const [text] = await deepl(['ping'], 'pt', 'en');
    return { ok: true, status: 200, sample: text };
  } catch (err) {
    return { ok: false, status: err.status ?? null, detail: err.detail ?? err.message };
  }
}

/** Traduz um lote usando os dois caches; retorna array alinhado à entrada. */
export async function translateBatch(texts, target = 'pt', source = 'en') {
  const results = new Array(texts.length);
  let missing = [];
  let missingIdx = [];

  // L1: memória.
  texts.forEach((text, i) => {
    const key = `${target}::${text}`;
    if (cache.has(key)) {
      results[i] = cache.get(key);
    } else {
      missing.push(text);
      missingIdx.push(i);
    }
  });

  // L2: KV. Poupa o DeepL depois de um cold start, quando a L1 está vazia.
  if (missing.length && kvEnabled()) {
    const hits = await kvGetMany(missing.map((t) => cacheKey(target, t)));
    const stillMissing = [];
    const stillMissingIdx = [];

    missing.forEach((text, j) => {
      const hit = hits[j];
      if (typeof hit === 'string') {
        cache.set(`${target}::${text}`, hit); // promove para a L1
        results[missingIdx[j]] = hit;
      } else {
        stillMissing.push(text);
        stillMissingIdx.push(missingIdx[j]);
      }
    });
    missing = stillMissing;
    missingIdx = stillMissingIdx;
  }

  if (missing.length) {
    let translated;
    if (process.env.DEEPL_API_KEY) {
      translated = await deepl(missing, target, source);
    } else if (process.env.TRANSLATE_MOCK === '1') {
      translated = missing.map((t) => `«${t}»`);
    } else {
      translated = missing; // identidade (sem chave)
    }
    missing.forEach((text, j) => {
      cache.set(`${target}::${text}`, translated[j]);
      results[missingIdx[j]] = translated[j];
    });

    // Só vale gravar tradução de verdade: identidade encheria o KV de lixo.
    if (kvEnabled() && providerName() !== 'identity') {
      await kvSetMany(
        missing.map((text, j) => ({
          key: cacheKey(target, text),
          value: translated[j],
        })),
      );
    }
  }

  return results;
}
