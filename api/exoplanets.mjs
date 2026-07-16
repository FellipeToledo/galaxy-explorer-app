/**
 * Função serverless da Vercel — GET /api/exoplanets?dataset=<nome>
 *
 * Existe porque o NASA Exoplanet Archive não manda CORS: o navegador não pode
 * chamá-lo direto (ver server/exoplanets-core.mjs).
 */
import {
  datasetNames,
  getDataset,
  isDataset,
} from '../server/exoplanets-core.mjs';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const dataset = url.searchParams.get('dataset') ?? '';

  if (!isDataset(dataset)) {
    res.status(400).json({
      error: 'dataset_invalido',
      // O cliente escolhe de uma lista fechada; nunca manda SQL.
      allowed: datasetNames(),
    });
    return;
  }

  try {
    const { rows, cache } = await getDataset(dataset);
    // O conteúdo muda em lotes; deixar a CDN guardar tira carga da função.
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.status(200).json({ dataset, count: rows.length, cache, rows });
  } catch (err) {
    console.error('exoplanets error:', err?.message);
    res.status(err?.status ?? 502).json({
      error: 'exoplanets_failed',
      upstream: err?.upstream ?? null,
      detail: err?.detail ?? err?.message ?? null,
    });
  }
}
