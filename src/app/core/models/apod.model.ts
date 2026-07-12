/** Resposta da API APOD (Astronomy Picture of the Day). */
export interface Apod {
  date: string;
  title: string;
  explanation: string;
  /** 'image' ou 'video' */
  media_type: 'image' | 'video';
  url: string;
  /** Versão em alta resolução (apenas quando media_type === 'image'). */
  hdurl?: string;
  copyright?: string;
  service_version?: string;
}
