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

async function deepl(texts, target, source) {
  const url =
    process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate';
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
    throw new Error(`DeepL respondeu ${res.status}`);
  }
  const data = await res.json();
  return data.translations.map((t) => t.text);
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
