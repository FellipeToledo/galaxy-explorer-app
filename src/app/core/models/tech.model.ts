/**
 * Modelos da seção "Tecnologia" (NASA TechTransfer).
 *
 * Fonte: `technology.nasa.gov/api/query/patent/<termo>`, via o nosso
 * `/api/techtransfer` — a API só libera CORS para o próprio site, e o antigo
 * `api.nasa.gov/techtransfer` devolve 302 para uma página de documentação.
 *
 * O proxy já entrega isto pronto: a API responde **arrays de 13 posições** com
 * HTML embutido; a normalização mora em `server/techtransfer-core.mjs`.
 */

/** Patente da NASA disponível para licenciamento. */
export interface Patent {
  id: string;
  /** Ex.: "GSC-TOPS-247" — é o identificador público da patente. */
  caseNumber: string;
  title: string;
  description: string;
  /** Ex.: "robotics automation and control". */
  category: string;
  /** Centro da NASA (GSFC, ARC, LEW…). */
  center: string;
  /** Sempre presente em patentes (medido: 175/175); pode dar 403 isolado. */
  imageUrl: string | null;
}

export interface PatentResponse {
  q: string;
  count: number;
  cache: 'memory' | 'kv' | 'miss';
  rows: Patent[];
}

/**
 * Termos de partida: a API **exige** termo (sem ele o corpo volta vazio), então
 * a seção precisa sugerir por onde começar.
 */
export const TECH_SUGGESTIONS: string[] = [
  'robot',
  'sensor',
  'battery',
  'engine',
  'coating',
  'antenna',
  'laser',
  'propulsion',
  'medical',
  'water',
  'solar',
  'materials',
];

/** Página pública da patente — o "quero saber mais" da seção. */
export function patentUrl(caseNumber: string): string {
  return `https://technology.nasa.gov/patent/${encodeURIComponent(caseNumber)}`;
}
