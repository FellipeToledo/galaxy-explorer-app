/**
 * Testes do proxy de exoplanetas — `node --test`.
 *
 * O que importa aqui: o cliente **não pode** injetar SQL (senão o app vira um
 * túnel aberto para o TAP) e o cache precisa funcionar (o arquivo leva ~2,5 s
 * por consulta).
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  datasetNames,
  getDataset,
  isDataset,
} from './exoplanets-core.mjs';

const fetchOriginal = globalThis.fetch;
let chamadas = [];

beforeEach(() => {
  chamadas = [];
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

/** Finge o TAP: registra a URL chamada e devolve `rows`. */
function stubTap(rows, { ok = true, status = 200 } = {}) {
  globalThis.fetch = async (url) => {
    chamadas.push(String(url));
    return {
      ok,
      status,
      json: async () => rows,
      text: async () => JSON.stringify(rows),
    };
  };
}

describe('lista fechada de datasets', () => {
  test('conhece os quatro datasets da seção', () => {
    assert.deepEqual(datasetNames().sort(), [
      'byMethod',
      'byYear',
      'massRadius',
      'nearest',
    ]);
  });

  test('aceita só o que está na lista', () => {
    assert.equal(isDataset('byYear'), true);
    assert.equal(isDataset('nearest'), true);
  });

  test('recusa SQL e nomes inventados — o cliente nunca manda query', () => {
    assert.equal(isDataset('select * from ps'), false);
    assert.equal(isDataset('byYear; drop table ps'), false);
    assert.equal(isDataset(''), false);
    assert.equal(isDataset('__proto__'), false); // não herda do Object
    assert.equal(isDataset('constructor'), false);
    assert.equal(isDataset('toString'), false);
  });

  test('getDataset rejeita dataset desconhecido com 400, sem chamar o TAP', async () => {
    stubTap([]);
    await assert.rejects(() => getDataset('drop table ps'), (err) => {
      assert.equal(err.status, 400);
      return true;
    });
    assert.equal(chamadas.length, 0, 'não pode tocar no TAP');
  });
});

describe('consulta e cache', () => {
  test('busca no TAP e devolve as linhas', async () => {
    stubTap([{ disc_year: 2026, n: 236 }]);
    const { rows, cache } = await getDataset('byYear');
    assert.deepEqual(rows, [{ disc_year: 2026, n: 236 }]);
    assert.equal(cache, 'miss');
    assert.equal(chamadas.length, 1);
  });

  test('a query vai só na URL do TAP, com default_flag=1', async () => {
    stubTap([]);
    await getDataset('byMethod');
    const url = decodeURIComponent(chamadas[0]);
    assert.ok(url.startsWith('https://exoplanetarchive.ipac.caltech.edu/TAP/sync'));
    // sem default_flag=1 a `ps` devolve ~40 mil linhas (uma por publicação)
    assert.ok(url.includes('default_flag=1'), 'a contagem sairia inflada');
    assert.ok(url.includes('format=json'));
  });

  // O cache é de módulo e sobrevive entre os testes: cada um usa um dataset
  // próprio, senão o vizinho já teria populado a memória.
  test('a 2ª chamada vem da memória, sem tocar no TAP', async () => {
    stubTap([{ pl_name: 'Kepler-939 b', pl_rade: 1.75, pl_bmasse: 4 }]);
    const primeira = await getDataset('massRadius');
    assert.equal(primeira.cache, 'miss');
    const segunda = await getDataset('massRadius');
    assert.equal(segunda.cache, 'memory');
    assert.deepEqual(segunda.rows, primeira.rows);
    assert.equal(chamadas.length, 1, 'o TAP só pode ter sido chamado uma vez');
  });

  // Erro não cacheia → 'nearest' segue livre para o teste seguinte.
  test('erro do arquivo vira 502 com o status de origem', async () => {
    stubTap({ erro: 'indisponível' }, { ok: false, status: 503 });
    await assert.rejects(() => getDataset('nearest'), (err) => {
      assert.equal(err.status, 502);
      assert.equal(err.upstream, 503);
      return true;
    });
  });

  test('resposta que não é lista vira 502 (não passa lixo para o front)', async () => {
    stubTap({ mensagem: 'erro em HTML' });
    await assert.rejects(() => getDataset('nearest'), (err) => {
      assert.equal(err.status, 502);
      return true;
    });
  });
});
