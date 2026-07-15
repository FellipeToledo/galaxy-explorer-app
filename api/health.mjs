/**
 * Função serverless da Vercel — GET /api/health (diagnóstico).
 *
 * `?check=deepl` faz uma tradução real de uma palavra e reporta o status
 * devolvido pela DeepL. Sem isso, o health só afirma que a env var existe —
 * e "env var presente" não é o mesmo que "a API aceita a chave".
 */
import {
  providerName,
  cacheSize,
  cacheBackend,
  providerDiagnostics,
  selfTest,
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
  if (url.searchParams.get('check') === 'deepl') {
    body.check = await selfTest();
  }

  res.status(200).json(body);
}
