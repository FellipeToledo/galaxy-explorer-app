/**
 * Camada de cache durável opcional (Vercel KV / Upstash Redis).
 *
 * Falamos com o KV pela **REST API, via fetch** — sem `@vercel/kv` nem
 * qualquer dependência, mantendo `server/` em Node puro.
 *
 * Config por variáveis de ambiente (as duas do par são obrigatórias):
 *   KV_REST_API_URL + KV_REST_API_TOKEN              (Vercel KV)
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (Upstash direto)
 *
 * Sem elas, o cache durável fica desligado e só a memória é usada — é o caso
 * do dev local e de qualquer deploy sem KV provisionado.
 *
 * REGRA: o cache nunca pode derrubar uma tradução. Todo erro daqui é engolido
 * (com aviso) e o chamador segue para o DeepL.
 */
import { createHash } from 'node:crypto';

/** TTL das entradas: 30 dias. Tradução de texto da NASA não "estraga". */
const TTL_SECONDS = 60 * 60 * 24 * 30;

/** Evita encher o log com o mesmo aviso a cada request. */
let warned = false;

function warnOnce(message, err) {
  if (!warned) {
    warned = true;
    console.warn(`[kv-cache] ${message}: ${err?.message ?? err}`);
  }
}

function config() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

export function kvEnabled() {
  return config() !== null;
}

/**
 * Chave da entrada. O texto vira hash: chaves de Redis com o texto inteiro
 * ficariam enormes e ainda vazariam o conteúdo no painel do KV.
 */
export function cacheKey(target, text) {
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 32);
  return `tr:${target}:${hash}`;
}

/** Envia comandos ao endpoint /pipeline; devolve os resultados ou null. */
async function pipeline(commands) {
  const cfg = config();
  if (!cfg || !commands.length) {
    return null;
  }
  try {
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      // Um KV lento não pode segurar a resposta ao usuário.
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      throw new Error(`KV respondeu ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    warnOnce('leitura/escrita falhou; seguindo só com a memória', err);
    return null;
  }
}

/**
 * Busca várias chaves de uma vez.
 * @returns {Promise<(string|null)[]>} alinhado a `keys` (null = ausente).
 */
export async function kvGetMany(keys) {
  if (!keys.length) {
    return [];
  }
  const out = await pipeline([['MGET', ...keys]]);
  const values = out?.[0]?.result;
  return Array.isArray(values) ? values : keys.map(() => null);
}

/** Grava várias entradas com TTL. Erros são engolidos (cache é acessório). */
export async function kvSetMany(entries) {
  const commands = entries.map(({ key, value }) => [
    'SET',
    key,
    value,
    'EX',
    String(TTL_SECONDS),
  ]);
  await pipeline(commands);
}
