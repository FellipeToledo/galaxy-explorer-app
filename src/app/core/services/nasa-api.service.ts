import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppConfigService } from '../config/app-config.service';
import { Apod } from '../models/apod.model';
import { NasaImage } from '../models/mars.model';
import { Neo } from '../models/neo.model';

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

/** Formato bruto da resposta do NeoWs (`/neo/rest/v1/feed`). */
interface NeoApproach {
  close_approach_date?: string;
  close_approach_date_full?: string;
  relative_velocity?: { kilometers_per_hour?: string };
  miss_distance?: { kilometers?: string; lunar?: string };
}
interface NeoObject {
  id?: string;
  name?: string;
  absolute_magnitude_h?: number;
  nasa_jpl_url?: string;
  is_potentially_hazardous_asteroid?: boolean;
  estimated_diameter?: { meters?: { estimated_diameter_min?: number; estimated_diameter_max?: number } };
  close_approach_data?: NeoApproach[];
}
interface NeoFeedResponse {
  near_earth_objects?: Record<string, NeoObject[]>;
}

/**
 * Serviço central de acesso às APIs abertas da NASA.
 * - api.nasa.gov (APOD, etc.) usa a chave da configuração.
 * - images-api.nasa.gov (biblioteca de mídia) é aberta e não exige chave.
 */
@Injectable({ providedIn: 'root' })
export class NasaApiService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  private readonly imageBase = 'https://images-api.nasa.gov';

  private get base(): string {
    return this.appConfig.nasaApiBase;
  }

  private withKey(params: Record<string, string | number> = {}): HttpParams {
    let httpParams = new HttpParams().set('api_key', this.appConfig.nasaApiKey);
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
  searchImages(
    query: string,
    page = 1,
    yearStart?: string,
    yearEnd?: string,
  ): Observable<NasaImage[]> {
    let params = new HttpParams()
      .set('q', query)
      .set('media_type', 'image')
      .set('page', String(page));
    if (yearStart) {
      params = params.set('year_start', yearStart);
    }
    if (yearEnd) {
      params = params.set('year_end', yearEnd);
    }
    return this.http
      .get<ImageLibraryResponse>(`${this.imageBase}/search`, { params })
      .pipe(map((res) => this.mapImages(res)));
  }

  // ── NeoWs — Near Earth Object Web Service ───────────────────────────────
  /**
   * Asteroides com aproximação da Terra entre duas datas (YYYY-MM-DD).
   * A janela aceita pelo feed é de no máximo 7 dias.
   */
  getNeoFeed(startDate: string, endDate: string): Observable<Neo[]> {
    return this.http
      .get<NeoFeedResponse>(`${this.base}/neo/rest/v1/feed`, {
        params: this.withKey({ start_date: startDate, end_date: endDate }),
      })
      .pipe(map((res) => this.mapNeos(res)));
  }

  private mapNeos(res: NeoFeedResponse): Neo[] {
    const byDate = res.near_earth_objects ?? {};
    const list: Neo[] = [];

    for (const [date, objects] of Object.entries(byDate)) {
      for (const obj of objects ?? []) {
        // O feed agrupa por data, mas cada objeto repete todas as aproximações:
        // usamos a que corresponde ao dia do grupo (senão, a primeira).
        const approach =
          obj.close_approach_data?.find((a) => a.close_approach_date === date) ??
          obj.close_approach_data?.[0];
        const meters = obj.estimated_diameter?.meters;
        const min = meters?.estimated_diameter_min;
        const max = meters?.estimated_diameter_max;
        if (!obj.id || min == null || max == null || !approach) {
          continue;
        }
        list.push({
          id: obj.id,
          // A API entrega o nome entre parênteses: "(2019 AB1)".
          name: (obj.name ?? obj.id).replace(/^\(|\)$/g, ''),
          diameterMin: min,
          diameterMax: max,
          diameterAvg: (min + max) / 2,
          hazardous: obj.is_potentially_hazardous_asteroid === true,
          velocityKph: Number(approach.relative_velocity?.kilometers_per_hour ?? 0),
          missKm: Number(approach.miss_distance?.kilometers ?? 0),
          missLunar: Number(approach.miss_distance?.lunar ?? 0),
          approachDate: date,
          approachFull: approach.close_approach_date_full,
          absoluteMagnitude: obj.absolute_magnitude_h,
          jplUrl: obj.nasa_jpl_url,
        });
      }
    }
    return list.sort((a, b) => a.missKm - b.missKm);
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
