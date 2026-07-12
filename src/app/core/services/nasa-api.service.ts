import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Apod } from '../models/apod.model';
import { MarsPhotosResponse, RoverName } from '../models/mars.model';

/**
 * Serviço central de acesso às APIs abertas da NASA (https://api.nasa.gov/).
 * A chave é anexada automaticamente em cada requisição.
 */
@Injectable({ providedIn: 'root' })
export class NasaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.nasaApiBase;

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

  // ── Mars Rover Photos ───────────────────────────────────────────────────
  /**
   * Fotos de um rover em uma data terrestre (YYYY-MM-DD).
   * `camera` opcional filtra por câmera (ex.: FHAZ, NAVCAM, MAST).
   */
  getMarsPhotos(
    rover: RoverName,
    earthDate: string,
    camera?: string,
    page = 1,
  ): Observable<MarsPhotosResponse> {
    const params: Record<string, string | number> = {
      earth_date: earthDate,
      page,
    };
    if (camera) {
      params['camera'] = camera;
    }
    return this.http.get<MarsPhotosResponse>(
      `${this.base}/mars-photos/api/v1/rovers/${rover}/photos`,
      { params: this.withKey(params) },
    );
  }
}
