export const environment = {
  production: true,
  nasaApiKey: 'DEMO_KEY',
  nasaApiBase: 'https://api.nasa.gov',
  translateApiUrl: '/api/translate',
  /** Proxy do Exoplanet Archive (ele não manda CORS). */
  exoplanetsApiUrl: '/api/exoplanets',
  /** Proxy do TechTransfer (CORS liberado só para o site deles). */
  techApiUrl: '/api/techtransfer',
};
