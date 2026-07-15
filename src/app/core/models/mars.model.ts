/**
 * Modelos da seção "Marte".
 *
 * A API oficial Mars Rover Photos foi ARQUIVADA pela NASA (2025), então a
 * galeria passou a usar a NASA Image and Video Library (images-api.nasa.gov),
 * que está ativa e não exige chave. Cada chip de rover vira uma busca.
 */

/** Item de imagem normalizado a partir da Image & Video Library. */
export interface NasaImage {
  nasaId: string;
  title: string;
  description?: string;
  dateCreated?: string;
  center?: string;
  thumbUrl: string;
  /**
   * `collection.json` do item — lista os tamanhos disponíveis (~orig, ~large,
   * ~medium…). Buscado sob demanda ao abrir o lightbox, que antes exibia o
   * thumbnail esticado.
   */
  collectionUrl?: string;
}

/** Assets de um item, resolvidos a partir do `collection.json`. */
export interface NasaImageAssets {
  /** ~large (~280 KB): o que o lightbox exibe. */
  displayUrl?: string;
  /** ~orig: pode passar de 10 MB → só link, nunca exibido. */
  originalUrl?: string;
}

export type RoverName = 'perseverance' | 'curiosity' | 'opportunity' | 'spirit';

/** Chips de rover: cada um define a busca enviada à biblioteca. */
export const ROVERS: { name: RoverName; label: string; query: string }[] = [
  { name: 'perseverance', label: 'Perseverance', query: 'Perseverance rover Mars' },
  { name: 'curiosity', label: 'Curiosity', query: 'Curiosity rover Mars' },
  { name: 'opportunity', label: 'Opportunity', query: 'Opportunity rover Mars' },
  { name: 'spirit', label: 'Spirit', query: 'Spirit rover Mars' },
];

/** Modos de ordenação (client-side; a API só entrega por relevância). */
export type SortMode = 'relevance' | 'newest' | 'oldest';

export const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'relevance', label: 'Relevância' },
  { id: 'newest', label: 'Mais recentes' },
  { id: 'oldest', label: 'Mais antigas' },
];
