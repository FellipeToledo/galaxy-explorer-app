/**
 * Gera `public/config.json` a partir de variáveis de ambiente, no build.
 *
 * POR QUE ISSO EXISTE: `public/config.json` é gitignored (para ninguém commitar
 * chave), então ele **nunca chega na Vercel** — e lá o app caía no `DEMO_KEY`
 * do environment, que é compartilhado por IP e vive estourado (HTTP 429). Todas
 * as seções que usam api.nasa.gov (APOD, Asteroides, Terra) quebravam em
 * produção; só Marte sobrevivia, porque a Image Library não exige chave.
 *
 * Na Vercel: defina `NASA_API_KEY` em Settings → Environment Variables (marque
 * Production **e** Preview). Este script roda antes do `ng build` e escreve o
 * arquivo que o AppConfigService lê no boot.
 *
 * Localmente: sem `NASA_API_KEY` no ambiente, o script **não toca** num
 * `config.json` existente — a chave do dev continua onde está.
 *
 * ⚠️ Sendo front-end, a chave fica visível no cliente de qualquer forma (é o que
 * o environment.ts já assume). Este script só evita que ela passe pelo git.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'config.json');

const key = process.env.NASA_API_KEY?.trim();

if (!key) {
  // Sem env var: preserva o arquivo do dev; nunca sobrescreve com DEMO_KEY.
  const status = existsSync(target)
    ? 'mantendo o public/config.json existente'
    : 'nenhum config.json — o app usará DEMO_KEY (limite 30/h por IP)';
  console.log(`[config] NASA_API_KEY não definida → ${status}.`);
  process.exit(0);
}

const fromEnv = { nasaApiKey: key };

// Permite sobrescrever a base da API sem novo deploy de código (raro, mas o
// AppConfigService já suporta).
if (process.env.NASA_API_BASE?.trim()) {
  fromEnv.nasaApiBase = process.env.NASA_API_BASE.trim();
}

// Preserva chaves do arquivo que este script não gerencia, mas o ambiente
// SEMPRE vence: é ele que traz a chave do deploy (o arquivo pode ter um
// DEMO_KEY velho, e mantê-lo recriaria o bug do 429 em produção).
let config = fromEnv;
if (existsSync(target)) {
  try {
    const current = JSON.parse(readFileSync(target, 'utf8'));
    config = { ...current, ...fromEnv };
  } catch {
    // Arquivo inválido: será substituído pelo config do ambiente.
  }
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(config, null, 2) + '\n');

// Nunca logar a chave — o log de build da Vercel é visível.
console.log(
  `[config] public/config.json gerado com NASA_API_KEY (${key.length} chars).`,
);
