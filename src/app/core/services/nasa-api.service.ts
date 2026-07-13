import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Apod } from '../models/apod.model';
import { NasaImage } from '../models/mars.model';

/** Formato bruto da resposta da NASA Image and Video Library. */
interface ImageLibraryItem {
  data?: {
    nasa_id?: string;
    title?: string;
    description?: string;
    date_created?: string;
    center?: string;
  }[];
  links?: { href?: string; render?: string; rel?: string }[];
}
interface ImageLibraryResponse {
  collection?: { items?: ImageLibraryItem[] };
}

/**
 * Serviço central de acesso às APIs abertas da NASA.
 * - api.nasa.gov (APOD, etc.) usa a chave da configuração.
 * - images-api.nasa.gov (biblioteca de mídia) é aberta e não exige chave.
 */
@Injectable({ providedIn: 'root' })
export class NasaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.nasaApiBase;
  private readonly imageBase = 'https://images-api.nasa.gov';

  private withKey(params: Record<string, string | number> = {}): HttpParams {
    let httpParams = new HttpParams().set('api_key', environment.nasaApiKey);
    for (const [key, value] of Object.entries(params)) {
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }

  // ── APOD — Astronomy Picture of the Day ────────────────────────────────
  /** Foto astronômica do dia (ou de uma data específica YYYY-MM-DD). */
  getApod(date?: string): Observable<Apod> {
    const params: Record<string, string> = date ? { date } : {};
    return this.http.get<Apod>(`${this.base}/planetary/apod`, {
      params: this.withKey(params),
    });
  }

  // ── NASA Image and Video Library ────────────────────────────────────────
  /**
   * Busca imagens no acervo oficial da NASA.
   * Substitui a API Mars Rover Photos (arquivada em 2025) e também serve
   * de base para uma futura busca livre de mídia.
   */
  searchImages(query: string, page = 1): Observable<NasaImage[]> {
    const params = new HttpParams()
      .set('q', query)
      .set('media_type', 'image')
      .set('page', String(page));
    return this.http
      .get<ImageLibraryResponse>(`${this.imageBase}/search`, { params })
      .pipe(map((res) => this.mapImages(res)));
  }

  private mapImages(res: ImageLibraryResponse): NasaImage[] {
    const items = res.collection?.items ?? [];
    return items
      .map((item): NasaImage | null => {
        const data = item.data?.[0];
        const thumbUrl = item.links?.find((l) => l.render === 'image')?.href
          ?? item.links?.[0]?.href;
        if (!data?.nasa_id || !thumbUrl) {
          return null;
        }
        return {
          nasaId: data.nasa_id,
          title: data.title ?? 'Sem título',
          description: data.description,
          dateCreated: data.date_created,
          center: data.center,
          thumbUrl,
        };
      })
      .filter((x): x is NasaImage => x !== null);
  }
}
