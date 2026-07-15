/**
 * Função serverless da Vercel — GET /api/health (diagnóstico).
 *
 * `?check=deepl` traduz uma palavra de verdade; `?check=kv` escreve e lê uma
 * chave no cache durável; `?check=all` faz os dois. Sem eles, o health só
 * afirma que as env vars existem — e "env var presente" não é o mesmo que
 * "funciona" (foi assim que uma quota estourada passou por chave inválida).
 */
import {
  providerName,
  cacheSize,
  cacheBackend,
  providerDiagnostics,
  selfTest,
  kvSelfTest,
} from '../server/translate-core.mjs';

export default async function handler(req, res) {
  const body = {
    ok: true,
    provider: providerName(),
    cached: cacheSize(),
    cache: cacheBackend(),
    deepl: providerDiagnostics(),
  };

  const url = new URL(req.url, 'http://localhost');
  const check = url.searchParams.get('check');

  if (check === 'deepl' || check === 'all') {
    body.check = await selfTest();
  }
  if (check === 'kv' || check === 'all') {
    body.kvCheck = await kvSelfTest();
  }

  res.status(200).json(body);
}
