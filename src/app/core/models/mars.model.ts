/**
 * Modelos da seção "Marte".
 *
 * A API oficial Mars Rover Photos foi ARQUIVADA pela NASA (2025), então a
 * galeria passou a usar a NASA Image and Video Library (images-api.nasa.gov),
 * que está ativa e não exige chave. Cada chip de rover vira uma busca.
 *
 * O item em si (`NasaMedia`) e a ordenação vivem em `media.model.ts`, porque
 * a Busca de mídia usa os mesmos.
 */

export type RoverName = 'perseverance' | 'curiosity' | 'opportunity' | 'spirit';

/** Chips de rover: cada um define a busca enviada à biblioteca. */
export const ROVERS: { name: RoverName; label: string; query: string }[] = [
  { name: 'perseverance', label: 'Perseverance', query: 'Perseverance rover Mars' },
  { name: 'curiosity', label: 'Curiosity', query: 'Curiosity rover Mars' },
  { name: 'opportunity', label: 'Opportunity', query: 'Opportunity rover Mars' },
  { name: 'spirit', label: 'Spirit', query: 'Spirit rover Mars' },
];
