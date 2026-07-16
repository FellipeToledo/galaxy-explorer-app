/**
 * Modelos da seção "Asteroides" (NeoWs — Near Earth Object Web Service).
 *
 * Fonte: `GET /neo/rest/v1/feed?start_date=…&end_date=…&api_key=…`
 * (janela máxima de 7 dias). A resposta traz os objetos agrupados por data de
 * aproximação; aqui tudo é normalizado numa lista plana de `Neo`.
 */

/** Asteroide normalizado a partir de um `NeoObject` do feed. */
export interface Neo {
  id: string;
  /**
   * Chave estável para o `@for`: `id@data`. Um mesmo asteroide pode ter mais
   * de uma aproximação no período (raro, mas o `id` sozinho arriscaria chave
   * duplicada — e a linha some da tabela sem aviso).
   */
  uid: string;
  name: string;
  /** Diâmetro estimado em metros (a NASA entrega uma faixa min–max). */
  diameterMin: number;
  diameterMax: number;
  /** Média da faixa — é o valor plotado nos gráficos. */
  diameterAvg: number;
  hazardous: boolean;
  /** Velocidade relativa da aproximação, em km/h. */
  velocityKph: number;
  /** Distância mínima da aproximação. */
  missKm: number;
  /** Mesma distância em distâncias lunares (1 = Terra→Lua). */
  missLunar: number;
  /** Data da aproximação (YYYY-MM-DD) — chave do agrupamento do feed. */
  approachDate: string;
  /** Data/hora legível da aproximação, como vem da API. */
  approachFull?: string;
  absoluteMagnitude?: number;
  jplUrl?: string;
}

/** Total de asteroides por dia, separados por periculosidade (gráfico de barras). */
export interface NeoDayCount {
  date: string;
  hazardous: number;
  safe: number;
  total: number;
}

/**
 * Períodos oferecidos no seletor.
 *
 * O feed aceita **no máximo 7 dias** por request (`400 BAD_REQUEST — The Feed
 * date limit is only 7 Days`), então os de 30 dias viram 5 chamadas
 * encadeadas. Medido: 30 dias ≈ 137 objetos e ~1,6 s com as chamadas em
 * paralelo — volume tranquilo para os gráficos e a tabela.
 */
export type NeoRange = 'next7' | 'today' | 'last7' | 'next30' | 'last30';

export const NEO_RANGES: NeoRange[] = [
  'today',
  'next7',
  'last7',
  'next30',
  'last30',
];

/** Janela máxima aceita por request do feed. */
export const NEO_FEED_MAX_DAYS = 7;

/** Distância Terra→Lua em km — base para converter km em distâncias lunares. */
export const LUNAR_DISTANCE_KM = 384_400;
