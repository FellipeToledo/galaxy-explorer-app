/** Função serverless da Vercel — GET /api/health (diagnóstico). */
import {
  providerName,
  cacheSize,
  cacheBackend,
} from '../server/translate-core.mjs';

export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    provider: providerName(),
    cached: cacheSize(),
    cache: cacheBackend(),
  });
}
