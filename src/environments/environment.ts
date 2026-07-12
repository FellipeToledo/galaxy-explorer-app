/**
 * Configuração de ambiente do Galaxy Explorer.
 *
 * A chave da API da NASA é obtida gratuitamente em https://api.nasa.gov/
 * Substitua o valor abaixo pela sua chave. `DEMO_KEY` funciona para testes,
 * porém tem limites de requisição bem baixos (30/hora, 50/dia).
 *
 * ⚠️ Por ser um app puramente front-end, a chave fica visível no bundle.
 * Para produção, considere um proxy/backend que injete a chave server-side.
 */
export const environment = {
  production: false,
  nasaApiKey: 'DEMO_KEY',
  nasaApiBase: 'https://api.nasa.gov',
};
