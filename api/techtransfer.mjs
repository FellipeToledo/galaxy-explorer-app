/**
 * Função serverless da Vercel — GET /api/techtransfer?q=<termo>
 *
 * Existe porque a API do TechTransfer só libera CORS para o próprio site
 * (ver server/techtransfer-core.mjs).
 */
import { normalizeTerm, searchPatents } from '../server/techtransfer-core.mjs';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const term = normalizeTerm(url.searchParams.get('q'));

  if (!term) {
    res.status(400).json({ error: 'termo_obrigatorio' });
    return;
  }

  try {
    const { rows, cache } = await searchPatents(term);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.status(200).json({ q: term, count: rows.length, cache, rows });
  } catch (err) {
    console.error('techtransfer error:', err?.message);
    res.status(err?.status ?? 502).json({
      error: 'techtransfer_failed',
      upstream: err?.upstream ?? null,
      detail: err?.detail ?? err?.message ?? null,
    });
  }
}
