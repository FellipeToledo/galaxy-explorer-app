/**
 * Modelos da seção "Tecnologia" (NASA TechTransfer).
 *
 * Fonte: `technology.nasa.gov/api/query/<coleção>/<termo>`, via o nosso
 * `/api/techtransfer` — a API só libera CORS para o próprio site, e o antigo
 * `api.nasa.gov/techtransfer` devolve 302 para uma página de documentação.
 *
 * O proxy já entrega isto pronto: a API responde **arrays de 13 posições** com
 * HTML embutido; a normalização mora em `server/techtransfer-core.mjs`.
 */

/** As três coleções da API. Medido (preenchimento por coleção): */
export type TechCollection = 'patent' | 'software' | 'spinoff';

export const TECH_COLLECTIONS: TechCollection[] = ['patent', 'software', 'spinoff'];

/** Item do TechTransfer. `license`/`link` só vêm no software; `imageUrl` só em patent. */
export interface TechItem {
  id: string;
  /** Ex.: "GSC-TOPS-247" — identificador público. */
  caseNumber: string;
  title: string;
  description: string;
  category: string;
  center: string;
  /** Tipo de licença (só software): "Open Source", "General Public Release"… */
  license: string | null;
  /** Repositório/site externo (só software, 66%). */
  link: string | null;
  /** Imagem (só patent: 175/175); pode dar 403 isolado. */
  imageUrl: string | null;
}

export interface TechResponse {
  type: TechCollection;
  q: string;
  count: number;
  cache: 'memory' | 'kv' | 'miss';
  rows: TechItem[];
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

/**
 * Página pública do item na NASA. As três coleções vivem sob /patent na URL
 * pública (o case number distingue: -TOPS- patente, -SO- spinoff…).
 */
export function techUrl(caseNumber: string): string {
  return `https://technology.nasa.gov/patent/${encodeURIComponent(caseNumber)}`;
}
