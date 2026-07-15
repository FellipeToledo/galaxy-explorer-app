/**
 * Modelos da mídia da NASA Image and Video Library (`images-api.nasa.gov`).
 *
 * Compartilhados pela seção Marte (busca contextual: rovers) e pela Busca de
 * mídia (busca livre no acervo inteiro) — o mesmo item, os mesmos cards.
 */

export type MediaType = 'image' | 'video';

/** Item normalizado da Image & Video Library. */
export interface NasaMedia {
  nasaId: string;
  title: string;
  description?: string;
  dateCreated?: string;
  center?: string;
  /** Miniatura (para vídeo, o frame de capa). */
  thumbUrl: string;
  mediaType: MediaType;
  /**
   * `collection.json` do item — lista os tamanhos/arquivos disponíveis.
   * Buscado sob demanda (lightbox): são 100 itens por página.
   */
  collectionUrl?: string;
}

/** Assets de um item, resolvidos a partir do `collection.json`. */
export interface MediaAssets {
  /** Imagem grande (~large ≈ 280 KB) exibida no lightbox. */
  displayUrl?: string;
  /** ~orig: passa de 10 MB → só link, nunca exibido. */
  originalUrl?: string;
  /**
   * Vídeo para o player. **Sempre com `preload="none"`**: o ~mobile do acervo
   * chega a 118 MB e o ~orig a 1,4 GB — o `<video>` faz streaming por range,
   * então só baixa se o usuário der play.
   */
  videoUrl?: string;
  /** Legendas WebVTT, quando o item tem. */
  captionsUrl?: string;
}

/** Modos de ordenação (client-side; a API só entrega por relevância). */
export type SortMode = 'relevance' | 'newest' | 'oldest';

export const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'relevance', label: 'Relevância' },
  { id: 'newest', label: 'Mais recentes' },
  { id: 'oldest', label: 'Mais antigas' },
];
