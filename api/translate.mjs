/**
 * Função serverless da Vercel — POST /api/translate.
 * Mesma lógica do servidor local, via server/translate-core.mjs.
 *
 * Configure DEEPL_API_KEY nas Environment Variables do projeto na Vercel.
 */
import { translateBatch } from '../server/translate-core.mjs';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const texts = Array.isArray(body.q) ? body.q : [body.q];
    const clean = texts.filter((t) => typeof t === 'string');
    const translations = await translateBatch(
      clean,
      body.target || 'pt',
      body.source || 'en',
    );
    res.status(200).json({ translations });
  } catch (err) {
    console.error('translate error:', err?.message);
    res.status(502).json({ error: 'translation_failed' });
  }
}
