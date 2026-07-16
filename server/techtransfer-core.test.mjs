/**
 * Testes do proxy do TechTransfer — `node --test`.
 *
 * O que protegem: o **mapa posicional** (a API devolve arrays de 13 campos, não
 * objetos — se a NASA reordenar, é aqui que quebra, não na cara do usuário) e a
 * limpeza do HTML que ela embute nos textos.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeTerm, searchPatents } from './techtransfer-core.mjs';

const fetchOriginal = globalThis.fetch;
let chamadas = [];

beforeEach(() => {
  chamadas = [];
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

/** Uma linha crua no formato da API: array de 13 posições. */
function linha({
  id = '1',
  caso = 'GSC-TOPS-247',
  titulo = 'Robot Interface',
  desc = 'Uma descrição',
  categoria = 'robotics',
  centro = 'GSFC',
  img = 'https://technology.nasa.gov/t2media/a.jpg',
} = {}) {
  return [id, caso, titulo, desc, caso, categoria, '', '', '', centro, img, '', '16.7'];
}

function stubApi(results, { ok = true, status = 200, texto = null } = {}) {
  globalThis.fetch = async (url) => {
    chamadas.push(String(url));
    const corpo = texto ?? JSON.stringify({ results, count: results.length, total: results.length });
    return { ok, status, text: async () => corpo };
  };
}

describe('normalizeTerm', () => {
  test('tira espaços das pontas', () => {
    assert.equal(normalizeTerm('  robot  '), 'robot');
  });

  test('corta termo absurdamente longo (isso é abuso, não busca)', () => {
    assert.equal(normalizeTerm('a'.repeat(500)).length, 80);
  });

  test('nulo/indefinido viram string vazia', () => {
    assert.equal(normalizeTerm(null), '');
    assert.equal(normalizeTerm(undefined), '');
  });
});

describe('searchPatents', () => {
  test('sem termo → 400, sem chamar a API (ela devolveria corpo vazio)', async () => {
    stubApi([]);
    await assert.rejects(() => searchPatents('   '), (err) => {
      assert.equal(err.status, 400);
      return true;
    });
    assert.equal(chamadas.length, 0);
  });

  test('o termo vai escapado na URL', async () => {
    stubApi([]);
    await searchPatents('heat shield');
    assert.ok(chamadas[0].endsWith('/query/patent/heat%20shield'), chamadas[0]);
  });

  test('array posicional vira objeto nomeado', async () => {
    stubApi([linha()]);
    const { rows } = await searchPatents('robot-1');
    assert.deepEqual(rows[0], {
      id: '1',
      caseNumber: 'GSC-TOPS-247',
      title: 'Robot Interface',
      description: 'Uma descrição',
      category: 'robotics',
      center: 'GSFC',
      imageUrl: 'https://technology.nasa.gov/t2media/a.jpg',
    });
  });

  test('remove o HTML que a API embute no termo casado', async () => {
    stubApi([
      linha({
        titulo: '<span class="highlight">Robot</span>-Driven Interface',
        desc: 'Many <span class="highlight">robot</span> operations &amp; tools',
      }),
    ]);
    const { rows } = await searchPatents('robot-2');
    // renderizar a tag como texto mostraria a marcação; interpretar seria injeção
    assert.equal(rows[0].title, 'Robot-Driven Interface');
    assert.equal(rows[0].description, 'Many robot operations & tools');
    assert.ok(!/[<>]/.test(rows[0].title + rows[0].description));
  });

  test('imagem com espaço no nome é escapada (senão volta 403)', async () => {
    stubApi([linha({ img: 'https://technology.nasa.gov/t2media/iStock Large P.jpg' })]);
    const { rows } = await searchPatents('robot-3');
    assert.ok(rows[0].imageUrl.includes('%20'), rows[0].imageUrl);
  });

  test('item sem imagem fica com null (não string vazia)', async () => {
    stubApi([linha({ img: '' })]);
    const { rows } = await searchPatents('robot-4');
    assert.equal(rows[0].imageUrl, null);
  });

  test('descarta linha sem id ou sem título', async () => {
    stubApi([linha({ id: '' }), linha({ titulo: '' }), 'nao-e-array']);
    const { rows } = await searchPatents('robot-5');
    assert.deepEqual(rows, []);
  });

  test('corpo vazio = nenhum resultado, não erro (a API não devolve [])', async () => {
    stubApi(null, { texto: '' });
    const { rows } = await searchPatents('xyzzyx');
    assert.deepEqual(rows, []);
  });

  test('a 2ª busca do mesmo termo vem da memória', async () => {
    stubApi([linha({ id: 'cacheado' })]);
    const primeira = await searchPatents('cache-teste');
    assert.equal(primeira.cache, 'miss');
    const segunda = await searchPatents('cache-teste');
    assert.equal(segunda.cache, 'memory');
    assert.equal(chamadas.length, 1);
  });

  test('erro da API vira 502 com o status de origem', async () => {
    stubApi([], { ok: false, status: 500 });
    await assert.rejects(() => searchPatents('erro-teste'), (err) => {
      assert.equal(err.status, 502);
      assert.equal(err.upstream, 500);
      return true;
    });
  });

  test('resposta não-JSON vira 502 (a API já respondeu HTML antes)', async () => {
    stubApi(null, { texto: '<!DOCTYPE html><html>doc</html>' });
    await assert.rejects(() => searchPatents('html-teste'), (err) => {
      assert.equal(err.status, 502);
      return true;
    });
  });
});
