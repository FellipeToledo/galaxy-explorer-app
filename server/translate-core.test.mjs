/**
 * Testes do núcleo de tradução — `node --test` (runner nativo, sem deps, como
 * o resto de `server/`).
 *
 * Cobre as regras que custaram caro nesta sessão:
 *  - Free×Pro têm hosts diferentes e o host errado devolve 403 disfarçado de
 *    "chave inválida";
 *  - o cache nunca pode derrubar a tradução;
 *  - `identity` não pode poluir o KV.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  deeplEndpoint,
  providerName,
  providerDiagnostics,
  translateBatch,
  cacheBackend,
  cacheSize,
} from './translate-core.mjs';
import { cacheKey, kvEnabled } from './kv-cache.mjs';

/** Limpa as env vars que os testes mexem. */
const VARS = [
  'DEEPL_API_KEY',
  'DEEPL_API_URL',
  'TRANSLATE_MOCK',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];
let saved = {};

beforeEach(() => {
  saved = Object.fromEntries(VARS.map((v) => [v, process.env[v]]));
  for (const v of VARS) delete process.env[v];
});

afterEach(() => {
  for (const v of VARS) {
    if (saved[v] === undefined) delete process.env[v];
    else process.env[v] = saved[v];
  }
});

describe('deeplEndpoint — Free e Pro são hosts diferentes', () => {
  test('chave terminada em :fx (Free) vai para api-free', () => {
    process.env.DEEPL_API_KEY = 'abc-123:fx';
    assert.equal(deeplEndpoint(), 'https://api-free.deepl.com/v2/translate');
  });

  test('chave sem :fx (Pro) vai para api.deepl.com', () => {
    process.env.DEEPL_API_KEY = 'abc-123';
    assert.equal(deeplEndpoint(), 'https://api.deepl.com/v2/translate');
  });

  test('DEEPL_API_URL vence a escolha automática', () => {
    process.env.DEEPL_API_KEY = 'abc-123:fx';
    process.env.DEEPL_API_URL = 'https://exemplo.test/v2/translate';
    assert.equal(deeplEndpoint(), 'https://exemplo.test/v2/translate');
  });

  test('espaços na chave não confundem a detecção do :fx', () => {
    process.env.DEEPL_API_KEY = '  abc-123:fx  ';
    assert.equal(deeplEndpoint(), 'https://api-free.deepl.com/v2/translate');
  });
});

describe('providerDiagnostics — diagnóstico sem expor a chave', () => {
  test('sem chave, só reporta a ausência', () => {
    assert.deepEqual(providerDiagnostics(), { keyPresent: false });
  });

  test('nunca devolve a chave em campo nenhum', () => {
    process.env.DEEPL_API_KEY = 'segredo-nao-vazar:fx';
    const d = providerDiagnostics();
    assert.ok(!JSON.stringify(d).includes('segredo-nao-vazar'));
    assert.equal(d.keyKind, 'free');
    assert.equal(d.host, 'api-free.deepl.com');
    assert.equal(d.endpointMatchesKey, true);
  });

  test('host trocado à mão é sinalizado (isso é 403 na certa)', () => {
    process.env.DEEPL_API_KEY = 'abc:fx';
    process.env.DEEPL_API_URL = 'https://api.deepl.com/v2/translate';
    const d = providerDiagnostics();
    assert.equal(d.endpointMatchesKey, false);
    assert.equal(d.urlOverridden, true);
  });
});

describe('providerName', () => {
  test('sem chave e sem mock → identity (devolve o original)', () => {
    assert.equal(providerName(), 'identity');
  });

  test('TRANSLATE_MOCK=1 → mock', () => {
    process.env.TRANSLATE_MOCK = '1';
    assert.equal(providerName(), 'mock');
  });

  test('com chave → deepl', () => {
    process.env.DEEPL_API_KEY = 'x:fx';
    assert.equal(providerName(), 'deepl');
  });
});

describe('translateBatch', () => {
  test('identity devolve o texto original, alinhado à entrada', async () => {
    const out = await translateBatch(['Mars', 'Earth'], 'pt', 'en');
    assert.deepEqual(out, ['Mars', 'Earth']);
  });

  test('mock traduz e o resultado fica no cache de memória', async () => {
    process.env.TRANSLATE_MOCK = '1';
    const antes = cacheSize();
    const texto = 'Cache me ' + Math.random();
    const [a] = await translateBatch([texto], 'pt', 'en');
    assert.equal(a, `«${texto}»`);
    assert.ok(cacheSize() > antes, 'deveria ter guardado na L1');
    // 2ª chamada vem do cache (mesmo resultado, sem novo trabalho)
    const [b] = await translateBatch([texto], 'pt', 'en');
    assert.equal(b, a);
  });

  test('lote vazio não quebra', async () => {
    assert.deepEqual(await translateBatch([], 'pt', 'en'), []);
  });
});

describe('cache durável (KV)', () => {
  test('desligado sem as env vars → só memória', () => {
    assert.equal(kvEnabled(), false);
    assert.equal(cacheBackend(), 'memory');
  });

  test('o par KV_REST_API_* liga o cache', () => {
    process.env.KV_REST_API_URL = 'https://kv.test';
    process.env.KV_REST_API_TOKEN = 'token';
    assert.equal(kvEnabled(), true);
    assert.equal(cacheBackend(), 'memory+kv');
  });

  test('o par UPSTASH_REDIS_REST_* também liga', () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://kv.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    assert.equal(kvEnabled(), true);
  });

  test('só metade do par não liga (evita meia-configuração)', () => {
    process.env.KV_REST_API_URL = 'https://kv.test';
    assert.equal(kvEnabled(), false);
  });

  test('a chave é hash: não vaza o texto e tem tamanho fixo', () => {
    const texto = 'Um texto bem longo '.repeat(50);
    const k = cacheKey('pt', texto);
    assert.match(k, /^tr:pt:[0-9a-f]{32}$/);
    assert.ok(!k.includes('Um texto'), 'o texto não pode ir na chave');
  });

  test('mesmo texto → mesma chave; idioma diferente → chave diferente', () => {
    assert.equal(cacheKey('pt', 'Mars'), cacheKey('pt', 'Mars'));
    assert.notEqual(cacheKey('pt', 'Mars'), cacheKey('en', 'Mars'));
    assert.notEqual(cacheKey('pt', 'Mars'), cacheKey('pt', 'Earth'));
  });

  test('KV inacessível não derruba a tradução (cai no provider)', async () => {
    process.env.TRANSLATE_MOCK = '1';
    // porta morta: kvGetMany/kvSetMany engolem o erro e seguem
    process.env.KV_REST_API_URL = 'http://127.0.0.1:1';
    process.env.KV_REST_API_TOKEN = 'token';
    const texto = 'KV offline ' + Math.random();
    const [out] = await translateBatch([texto], 'pt', 'en');
    assert.equal(out, `«${texto}»`);
  });
});
