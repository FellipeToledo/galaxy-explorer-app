/**
 * Núcleo de tradução compartilhado pelo servidor local (server/index.mjs) e
 * pela função serverless da Vercel (api/translate.mjs).
 *
 * Config por variáveis de ambiente:
 *   DEEPL_API_KEY   chave da DeepL (ausente → ver TRANSLATE_MOCK)
 *   DEEPL_API_URL   endpoint (default: https://api-free.deepl.com/v2/translate)
 *   TRANSLATE_MOCK  =1 → traduções fictícias «texto» (testes, sem chave)
 *
 * Sem chave e sem MOCK, devolve o texto original (identidade).
 */

/** Cache em memória (persiste em instâncias "quentes" do serverless). */
const cache = new Map();

export function providerName() {
  if (process.env.DEEPL_API_KEY) return 'deepl';
  if (process.env.TRANSLATE_MOCK === '1') return 'mock';
  return 'identity';
}

export function cacheSize() {
  return cache.size;
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

/** Traduz um lote usando cache; retorna array alinhado à entrada. */
export async function translateBatch(texts, target = 'pt', source = 'en') {
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
  }

  return results;
}
