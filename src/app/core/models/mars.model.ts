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

/**
 * Câmera de um rover — **refino de busca, não filtro fiel**.
 *
 * A API antiga (Mars Rover Photos, arquivada) tinha `camera=MAST`; a Image
 * Library **não tem campo equivalente**, só texto livre. Então o chip apenas
 * acrescenta o nome da câmera ao termo, e a API casa em título/descrição —
 * imagens que não citam a câmera em lugar nenhum ficam de fora. É aproximado
 * por natureza; não prometer exatidão.
 */
export interface RoverCamera {
  /** Termo acrescentado à busca do rover. */
  id: string;
  label: string;
}

export interface Rover {
  name: RoverName;
  label: string;
  query: string;
  cameras: RoverCamera[];
}

/**
 * Chips de rover: cada um define a busca enviada à biblioteca.
 *
 * As câmeras foram **medidas no acervo** (busca `<rover> <câmera>`) e só entram
 * as que têm conteúdo de verdade. Ficaram de fora, por medição:
 * `Navcam`/`Hazcam` do Spirit (**0 itens**), `Hazcam` do Perseverance e do
 * Curiosity (12 e 7, e os resultados são fotos *do equipamento*), `MARDI`
 * (5 itens) e `WATSON` (o nome traz ruído — "WATSON's Field Test in Greenland").
 * **Se for mexer, meça de novo** — não chute.
 */
export const ROVERS: Rover[] = [
  {
    name: 'perseverance',
    label: 'Perseverance',
    query: 'Perseverance rover Mars',
    cameras: [
      { id: 'Mastcam-Z', label: 'Mastcam-Z' },
      { id: 'SHERLOC', label: 'SHERLOC' },
      { id: 'SuperCam', label: 'SuperCam' },
      { id: 'Navcam', label: 'Navcam' },
    ],
  },
  {
    name: 'curiosity',
    label: 'Curiosity',
    query: 'Curiosity rover Mars',
    cameras: [
      { id: 'Mastcam', label: 'Mastcam' },
      { id: 'MAHLI', label: 'MAHLI' },
      { id: 'ChemCam', label: 'ChemCam' },
      { id: 'Navcam', label: 'Navcam' },
    ],
  },
  {
    name: 'opportunity',
    label: 'Opportunity',
    query: 'Opportunity rover Mars',
    cameras: [
      { id: 'Pancam', label: 'Pancam' },
      { id: 'Microscopic Imager', label: 'Microscopic Imager' },
      { id: 'Navcam', label: 'Navcam' },
    ],
  },
  {
    name: 'spirit',
    label: 'Spirit',
    query: 'Spirit rover Mars',
    // Spirit não tem Navcam/Hazcam no acervo (0 itens) — chips seriam mortos.
    cameras: [
      { id: 'Pancam', label: 'Pancam' },
      { id: 'Microscopic Imager', label: 'Microscopic Imager' },
    ],
  },
];
