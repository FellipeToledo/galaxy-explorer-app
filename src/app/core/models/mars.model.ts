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
}

export type RoverName = 'perseverance' | 'curiosity' | 'opportunity' | 'spirit';

/** Chips de rover: cada um define a busca enviada à biblioteca. */
export const ROVERS: { name: RoverName; label: string; query: string }[] = [
  { name: 'perseverance', label: 'Perseverance', query: 'Perseverance rover Mars' },
  { name: 'curiosity', label: 'Curiosity', query: 'Curiosity rover Mars' },
  { name: 'opportunity', label: 'Opportunity', query: 'Opportunity rover Mars' },
  { name: 'spirit', label: 'Spirit', query: 'Spirit rover Mars' },
];

export type CategoryId = 'all' | 'rover' | 'surface' | 'team';

/**
 * Categorias como refinamentos de busca. O `modifier` é acrescentado à
 * query do rover para direcionar os resultados.
 */
export const MARS_CATEGORIES: {
  id: CategoryId;
  label: string;
  icon: string;
  modifier: string;
}[] = [
  { id: 'all', label: 'Todas', icon: '✨', modifier: '' },
  { id: 'rover', label: 'O Rover', icon: '🤖', modifier: 'selfie self-portrait' },
  { id: 'surface', label: 'Superfície', icon: '🪐', modifier: 'surface landscape terrain' },
  { id: 'team', label: 'Equipe & Missão', icon: '👩‍🚀', modifier: 'team engineers control room' },
];
