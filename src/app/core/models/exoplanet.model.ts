/**
 * Modelos da seção "Exoplanetas".
 *
 * Fonte: **NASA Exoplanet Archive** (TAP, Caltech/IPAC pela NASA), via o nosso
 * `/api/exoplanets` — o arquivo não manda CORS e o navegador bloqueia a chamada
 * direta. O `api.nasa.gov/exoplanet` antigo responde 404.
 *
 * Unidades do arquivo: raio e massa em **múltiplos da Terra**; distância em
 * **parsecs**.
 */

/** Datasets que o proxy aceita (lista fechada — o cliente não manda SQL). */
export type ExoDataset = 'byYear' | 'byMethod' | 'massRadius' | 'nearest';

/** Descobertas por ano. */
export interface ExoYear {
  disc_year: number;
  n: number;
}

/** Contagem por método de descoberta. */
export interface ExoMethod {
  discoverymethod: string;
  n: number;
}

/** Planeta (campos variam por dataset; nem todo planeta tem tudo medido). */
export interface Exoplanet {
  pl_name: string;
  hostname: string;
  discoverymethod: string;
  disc_year: number;
  /** Raio em raios terrestres. */
  pl_rade?: number | null;
  /** Massa em massas terrestres. */
  pl_bmasse?: number | null;
  /** Distância do sistema, em parsecs. */
  sy_dist?: number | null;
  /** Período orbital em dias. */
  pl_orbper?: number | null;
  disc_facility?: string | null;
}

export interface ExoResponse<T> {
  dataset: ExoDataset;
  count: number;
  /** De onde veio: memória, KV ou consulta nova ao arquivo. */
  cache: 'memory' | 'kv' | 'miss';
  rows: T[];
}

/** 1 parsec em anos-luz — o arquivo dá parsec, mas ano-luz é mais legível. */
export const LIGHT_YEARS_PER_PARSEC = 3.26156;

/**
 * Referências do Sistema Solar para o diagrama massa×raio: sem elas, "raio 11"
 * não diz nada. Valores em unidades terrestres (Terra = 1 por definição).
 */
export const SOLAR_REFERENCES: { name: string; radius: number; mass: number }[] = [
  { name: 'Terra', radius: 1, mass: 1 },
  { name: 'Netuno', radius: 3.86, mass: 17.15 },
  { name: 'Júpiter', radius: 11.21, mass: 317.8 },
];
