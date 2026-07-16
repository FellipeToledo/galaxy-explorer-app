/**
 * Núcleo da seção Tecnologia (NASA TechTransfer) — compartilhado pelo servidor
 * local e pela função serverless.
 *
 * DUAS COISAS QUE JUSTIFICAM ESTE ARQUIVO:
 *
 * 1. **Mudou de casa**: `api.nasa.gov/techtransfer` devolve **302** para
 *    `technology.nasa.gov/api` — e a página de destino é *documentação HTML*,
 *    não JSON. O endpoint vivo é `technology.nasa.gov/api/query/patent/<termo>`.
 * 2. **CORS restrito ao próprio site**: a API responde
 *    `Access-Control-Allow-Origin: https://technology.nasa.gov`, ou seja, o
 *    nosso domínio é bloqueado no navegador. Daí o proxy.
 *
 * Só **patentes**: medido, 175/175 têm imagem, enquanto `software` (0/84) e
 * `spinoff` (0/284) não têm nenhuma — cards sem imagem num app visual.
 */
import { kvEnabled, kvGetMany, kvSetMany } from './kv-cache.mjs';
import { createHash } from 'node:crypto';

const BASE = 'https://technology.nasa.gov/api/query/patent';

/**
 * A API devolve cada resultado como **array posicional de 13 campos**, não um
 * objeto. Os índices vieram de inspeção (patent/software/spinoff batem), então
 * ficam nomeados aqui: se a NASA reordenar, é este mapa que muda — e o teste
 * quebra antes do usuário ver campo trocado.
 */
const F = {
  id: 0,
  caseNumber: 1,
  title: 2,
  description: 3,
  category: 5,
  center: 9,
  image: 10,
};

/** Termo maior que isso é abuso, não busca. */
const MAX_TERM = 80;
/** As patentes mudam devagar; um dia de cache é de sobra. */
const TTL_SECONDS = 60 * 60 * 24;
const memoria = new Map();

/**
 * A API embute `<span class="highlight">` no termo casado, dentro do título e
 * da descrição. Renderizar isso como texto mostraria a tag crua; interpretar
 * como HTML seria injeção. Então tira-se a marcação.
 */
function stripHtml(texto) {
  return String(texto ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/** Array posicional → objeto nomeado. */
function toPatent(row) {
  if (!Array.isArray(row)) {
    return null;
  }
  const id = row[F.id];
  const title = stripHtml(row[F.title]);
  if (!id || !title) {
    return null;
  }
  return {
    id: String(id),
    caseNumber: stripHtml(row[F.caseNumber]),
    title,
    description: stripHtml(row[F.description]),
    category: stripHtml(row[F.category]),
    center: stripHtml(row[F.center]),
    // Alguns arquivos têm espaço no nome e voltam 403 sem encoding.
    imageUrl: row[F.image] ? encodeURI(String(row[F.image])) : null,
  };
}

export function normalizeTerm(term) {
  return String(term ?? '').trim().slice(0, MAX_TERM);
}

function cacheKeyOf(term) {
  const hash = createHash('sha256').update(term.toLowerCase()).digest('hex').slice(0, 16);
  return `tt:patent:${hash}`;
}

/**
 * Busca patentes por termo.
 * @returns {Promise<{rows: object[], cache: 'memory'|'kv'|'miss'}>}
 */
export async function searchPatents(term) {
  const busca = normalizeTerm(term);
  if (!busca) {
    // A API devolve corpo VAZIO sem termo (não uma lista vazia) — o front
    // nunca deveria chegar aqui, mas a regra fica explícita.
    const err = new Error('termo obrigatório');
    err.status = 400;
    throw err;
  }
  const key = cacheKeyOf(busca);

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
        // entrada corrompida: busca de novo
      }
    }
  }

  const rows = await queryApi(busca);
  memoria.set(key, rows);
  if (kvEnabled()) {
    await kvSetMany([{ key, value: JSON.stringify(rows) }], TTL_SECONDS);
  }
  return { rows, cache: 'miss' };
}

async function queryApi(term) {
  const res = await fetch(`${BASE}/${encodeURIComponent(term)}`, {
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`TechTransfer respondeu ${res.status}`);
    err.status = 502;
    err.upstream = res.status;
    throw err;
  }
  const texto = await res.text();
  if (!texto.trim()) {
    // Resposta vazia = nenhum resultado (a API não devolve `[]`).
    return [];
  }
  let data;
  try {
    data = JSON.parse(texto);
  } catch {
    const err = new Error('resposta não-JSON do TechTransfer');
    err.status = 502;
    err.detail = texto.slice(0, 120);
    throw err;
  }
  return (data.results ?? []).map(toPatent).filter(Boolean);
}
