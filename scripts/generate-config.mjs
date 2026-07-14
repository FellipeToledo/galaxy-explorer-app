/**
 * Gera `public/config.json` a partir de variáveis de ambiente no build.
 *
 * Usado principalmente na Vercel: defina `NASA_API_KEY` nas Environment
 * Variables do projeto (Production/Preview) e o build injeta a chave no
 * config.json que o app carrega em runtime — sem versionar a chave.
 *
 * Roda automaticamente antes de `npm run build` (script `prebuild`).
 *
 * Comportamento:
 *   - `NASA_API_KEY` definida → escreve public/config.json com a chave.
 *   - não definida → não faz nada (preserva um config.json local existente;
 *     sem ele, o app usa DEMO_KEY do environment).
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const key = process.env.NASA_API_KEY;

if (!key) {
  console.log(
    '[generate-config] NASA_API_KEY não definida — mantendo config local/DEMO_KEY.',
  );
  process.exit(0);
}

const config = { nasaApiKey: key };
// Permite sobrescrever a base e o proxy de tradução, se necessário.
if (process.env.NASA_API_BASE) config.nasaApiBase = process.env.NASA_API_BASE;
if (process.env.TRANSLATE_API_URL)
  config.translateApiUrl = process.env.TRANSLATE_API_URL;

mkdirSync('public', { recursive: true });
writeFileSync('public/config.json', JSON.stringify(config, null, 2) + '\n');
console.log(
  '[generate-config] public/config.json gerado a partir das env vars.',
);
