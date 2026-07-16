/**
 * Configuração de ambiente do Galaxy Explorer (VALORES PADRÃO / FALLBACK).
 *
 * NÃO edite este arquivo para colocar sua chave — ele é versionado e causaria
 * conflito no `git pull`. Em vez disso, crie `public/config.json` (gitignored)
 * a partir de `public/config.example.json` e coloque sua chave lá:
 *
 *   { "nasaApiKey": "SUA_CHAVE" }
 *
 * O AppConfigService carrega esse arquivo no boot e sobrescreve os padrões
 * abaixo. Sem o arquivo (clone novo/produção), usa `DEMO_KEY` (limites baixos:
 * 30/h, 50/dia). Chave gratuita em https://api.nasa.gov/.
 *
 * ⚠️ Sendo front-end, a chave fica visível no bundle; o config.json apenas
 * evita conflitos/commit acidental — não a torna secreta no cliente.
 */
export const environment = {
  production: false,
  nasaApiKey: 'DEMO_KEY',
  nasaApiBase: 'https://api.nasa.gov',
  /**
   * Proxy de tradução de conteúdo. Se definido, o app traduz textos da API
   * via este endpoint (backend + DeepL). Vazio → usa a Translator API do
   * navegador (on-device) como fallback. Veja server/index.mjs.
   */
  translateApiUrl: '/api/translate',
  /**
   * Proxy do NASA Exoplanet Archive. Não dá para apontar o front direto para
   * o arquivo: ele não manda CORS (ver server/exoplanets-core.mjs).
   */
  exoplanetsApiUrl: '/api/exoplanets',
  /** Proxy do TechTransfer (CORS liberado só para o site deles). */
  techApiUrl: '/api/techtransfer',
};
