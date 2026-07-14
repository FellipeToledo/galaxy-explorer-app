/**
 * Modelos da seção "Terra" (EPIC — Earth Polychromatic Imaging Camera).
 *
 * A câmera fica no satélite DSCOVR, no ponto de Lagrange L1, e fotografa o
 * disco completo da Terra iluminado várias vezes por dia. Cada dia vira uma
 * sequência de ~10–20 imagens → o slider temporal as percorre em ordem.
 */

/** Uma foto de disco completo, já com as URLs do arquivo montadas. */
export interface EpicImage {
  identifier: string;
  /** Legenda da NASA (texto livre em inglês → passa pelo pipe `ct`). */
  caption: string;
  /** Data/hora da captura, como vem da API ("YYYY-MM-DD HH:mm:ss"). */
  date: string;
  /** ISO 8601 (a API usa espaço no lugar do T; Safari não parseia assim). */
  dateIso: string;
  /** JPG 2048² — é o que a galeria exibe e pré-carrega (o PNG pesa demais
   *  para animar: são ~2 MB por quadro, ~20 quadros por dia). */
  imageUrl: string;
  /** PNG 2048² do arquivo — oferecido como "ver em alta resolução". */
  pngUrl: string;
  /** Coordenadas do ponto central do disco (o que está "de frente"). */
  lat: number;
  lon: number;
}

/** Velocidades do slider temporal (ms por quadro). */
export const EPIC_FRAME_MS = 420;
