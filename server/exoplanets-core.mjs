/**
 * Núcleo da seção Exoplanetas — compartilhado pelo servidor local
 * (server/index.mjs) e pela função serverless (api/exoplanets.mjs).
 *
 * POR QUE EXISTE UM PROXY AQUI: o NASA Exoplanet Archive (TAP, do Caltech/IPAC
 * pela NASA) **não manda `Access-Control-Allow-Origin`** — o navegador bloqueia
 * a chamada direta (verificado: "Failed to fetch", e o preflight devolve 502).
 * O `api.nasa.gov/exoplanet` antigo responde **404**: este arquivo é a fonte
 * viva. Então o front fala com a gente, e a gente fala com o TAP.
 *
 * SEGURANÇA: o cliente **nunca** manda SQL. Ele escolhe um `dataset` de uma
 * lista fechada — senão isto vira um túnel aberto para o TAP em nome do app.
 */
import { kvEnabled, kvGetMany, kvSetMany } from './kv-cache.mjs';
import { createHash } from 'node:crypto';

const TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';

/**
 * `default_flag=1` = a medição preferida de cada planeta. Sem isso a tabela
 * `ps` devolve **40 mil linhas** (uma por publicação) em vez dos ~6,3 mil
 * planetas confirmados — e todo número sairia inflado.
 */
const DEFAULT = 'where default_flag=1';

/** Consultas permitidas. Nada fora daqui chega ao TAP. */
const DATASETS = {
  /** Descobertas por ano — o gráfico de barras. */
  byYear: `select disc_year, count(*) as n from ps ${DEFAULT} group by disc_year order by disc_year`,
  /** Métodos de descoberta — stat tile e tabela. */
  byMethod: `select discoverymethod, count(*) as n from ps ${DEFAULT} group by discoverymethod order by n desc`,
  /**
   * Planetas com massa E raio conhecidos — a dispersão massa×raio.
   * O `top 900` segura o payload: são ~6,3 mil planetas, mas só parte tem os
   * dois valores, e a dispersão satura muito antes disso.
   */
  massRadius: `select top 900 pl_name, hostname, discoverymethod, disc_year, pl_rade, pl_bmasse, sy_dist
    from ps ${DEFAULT} and pl_rade is not null and pl_bmasse is not null
    order by pl_rade desc`,
  /** Os mais próximos da Terra — a tabela. */
  nearest: `select top 200 pl_name, hostname, discoverymethod, disc_year, pl_rade, pl_bmasse, sy_dist, pl_orbper, disc_facility
    from ps ${DEFAULT} and sy_dist is not null
    order by sy_dist asc`,
};

export function isDataset(name) {
  return Object.prototype.hasOwnProperty.call(DATASETS, name);
}

export function datasetNames() {
  return Object.keys(DATASETS);
}

/** O arquivo publica em lotes; um dia de cache é conservador e generoso. */
const TTL_SECONDS = 60 * 60 * 24;
/** L1: sobrevive entre requests na mesma instância quente. */
const memoria = new Map();

function cacheKeyOf(dataset) {
  const hash = createHash('sha256').update(DATASETS[dataset]).digest('hex').slice(0, 16);
  // o hash da query invalida o cache sozinho quando a consulta muda
  return `exo:${dataset}:${hash}`;
}

/**
 * Busca um dataset, com cache em duas camadas (memória → KV → TAP).
 * @returns {Promise<{rows: object[], cache: 'memory'|'kv'|'miss'}>}
 */
export async function getDataset(dataset) {
  if (!isDataset(dataset)) {
    const err = new Error(`dataset desconhecido: ${dataset}`);
    err.status = 400;
    throw err;
  }
  const key = cacheKeyOf(dataset);

  const local = memoria.get(key);
  if (local) {
    return { rows: local, cache: 'memory' };
  }

  if (kvEnabled()) {
    const [hit] = await kvGetMany([key]);
    if (typeof hit === 'string') {
      try {
        const rows = JSON.parse(hit);
        memoria.set(key, rows);
        return { rows, cache: 'kv' };
      } catch {
        // entrada corrompida: ignora e busca de novo
      }
    }
  }

  const rows = await queryTap(DATASETS[dataset]);
  memoria.set(key, rows);
  if (kvEnabled()) {
    // O cache é acessório: se o KV falhar, o dado já está a caminho do cliente.
    await kvSetMany([{ key, value: JSON.stringify(rows) }], TTL_SECONDS);
  }
  return { rows, cache: 'miss' };
}

async function queryTap(query) {
  const url = `${TAP}?query=${encodeURIComponent(query)}&format=json`;
  const res = await fetch(url, {
    // O TAP é lento em consultas agregadas; sem timeout a função serverless
    // ficaria pendurada até o limite da plataforma.
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Exoplanet Archive respondeu ${res.status}`);
    err.status = 502;
    err.upstream = res.status;
    err.detail = body.slice(0, 200);
    throw err;
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    const err = new Error('resposta inesperada do Exoplanet Archive');
    err.status = 502;
    err.detail = JSON.stringify(data).slice(0, 200);
    throw err;
  }
  return data;
}
