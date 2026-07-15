import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppConfigService } from '../config/app-config.service';
import { Apod } from '../models/apod.model';
import { MediaAssets, MediaType, NasaMedia } from '../models/media.model';
import { Neo } from '../models/neo.model';
import { EpicImage } from '../models/epic.model';

/** Formato bruto da resposta da NASA Image and Video Library. */
interface ImageLibraryItem {
  data?: {
    nasa_id?: string;
    title?: string;
    description?: string;
    date_created?: string;
    center?: string;
    media_type?: string;
  }[];
  links?: { href?: string; render?: string; rel?: string }[];
  /** Aponta para o `collection.json` do item (lista os tamanhos). */
  href?: string;
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

/** Formato bruto de um item do EPIC (`/EPIC/api/natural`). */
interface EpicItem {
  identifier?: string;
  caption?: string;
  image?: string;
  date?: string;
  centroid_coordinates?: { lat?: number; lon?: number };
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

  // ── EPIC — Earth Polychromatic Imaging Camera ───────────────────────────
  /** Datas (YYYY-MM-DD) que já têm imagens no arquivo, da mais recente p/ trás. */
  getEpicDates(): Observable<string[]> {
    return this.http
      .get<string[]>(`${this.base}/EPIC/api/natural/available`, {
        params: this.withKey(),
      })
      .pipe(map((dates) => [...(dates ?? [])].sort().reverse()));
  }

  /** Sequência de imagens de um dia (ou do dia mais recente, sem `date`). */
  getEpicImages(date?: string): Observable<EpicImage[]> {
    const path = date
      ? `${this.base}/EPIC/api/natural/date/${date}`
      : `${this.base}/EPIC/api/natural`;
    return this.http
      .get<EpicItem[]>(path, { params: this.withKey() })
      .pipe(map((items) => this.mapEpic(items)));
  }

  private mapEpic(items: EpicItem[]): EpicImage[] {
    return (items ?? [])
      .map((item): EpicImage | null => {
        if (!item.image || !item.date) {
          return null;
        }
        // O caminho do arquivo é derivado da data: /archive/natural/YYYY/MM/DD.
        const [ymd] = item.date.split(' ');
        const path = ymd.replace(/-/g, '/');
        return {
          identifier: item.identifier ?? item.image,
          caption: item.caption ?? '',
          date: item.date,
          // "YYYY-MM-DD HH:mm:ss" não é ISO válido em todo navegador; é UTC.
          dateIso: item.date.replace(' ', 'T') + 'Z',
          imageUrl: this.epicAsset(path, 'jpg', item.image),
          pngUrl: this.epicAsset(path, 'png', item.image),
          lat: item.centroid_coordinates?.lat ?? 0,
          lon: item.centroid_coordinates?.lon ?? 0,
        };
      })
      .filter((x): x is EpicImage => x !== null)
      // A API já entrega em ordem cronológica, mas o slider depende disso.
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /** URL do arquivo do EPIC (as imagens também exigem a chave). */
  private epicAsset(path: string, ext: 'png' | 'jpg', image: string): string {
    const key = encodeURIComponent(this.appConfig.nasaApiKey);
    return `${this.base}/EPIC/archive/natural/${path}/${ext}/${image}.${ext}?api_key=${key}`;
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
    mediaType: MediaType | 'image,video' = 'image',
  ): Observable<NasaMedia[]> {
    let params = new HttpParams()
      .set('media_type', mediaType)
      .set('page', String(page));
    // `q` é OPCIONAL: a API aceita filtrar só por ano/tipo (verificado — só
    // ano devolve milhares de itens). Mandar `q=` vazio funciona, mas omitir
    // deixa claro que é "navegar pelos filtros", não "buscar por nada".
    if (query.trim()) {
      params = params.set('q', query.trim());
    }
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

  /**
   * Sugestões de busca em tempo real.
   *
   * A Image Library não tem endpoint de autocomplete → usamos a própria busca
   * e extraímos palavras-chave dos títulos dos primeiros resultados. Cabe ao
   * chamador aplicar debounce e cancelamento (switchMap).
   */
  suggest(term: string, limit = 8): Observable<string[]> {
    const params = new HttpParams()
      .set('q', term)
      .set('media_type', 'image')
      .set('page_size', '30');
    return this.http
      .get<ImageLibraryResponse>(`${this.imageBase}/search`, { params })
      .pipe(map((res) => this.titlesToSuggestions(res, term, limit)));
  }

  /** Títulos → sugestões curtas, sem repetir e sem devolver o próprio termo. */
  private titlesToSuggestions(
    res: ImageLibraryResponse,
    term: string,
    limit: number,
  ): string[] {
    const lower = term.toLowerCase().trim();
    const seen = new Set<string>();
    const out: string[] = [];

    for (const item of res.collection?.items ?? []) {
      const title = item.data?.[0]?.title?.trim();
      if (!title) {
        continue;
      }
      // Títulos da NASA são longos e às vezes frases inteiras ("Have a Nice
      // Spring! MOC Revisits…") — corta na primeira pontuação forte.
      const clean = title.split(/[,;:(!?–—"]/)[0].trim().slice(0, 60);
      const key = clean.toLowerCase();
      if (!clean || key === lower || seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(clean);
      if (out.length >= limit) {
        break;
      }
    }
    return out;
  }

  /**
   * Assets de um item, a partir do seu `collection.json`.
   * Chamado sob demanda (lightbox) — são ~100 itens por página, buscar isso
   * para todos seria absurdo.
   */
  getMediaAssets(
    collectionUrl: string,
    mediaType: MediaType = 'image',
  ): Observable<MediaAssets> {
    return this.http.get<string[]>(collectionUrl).pipe(
      map((urls) => {
        const list = (urls ?? []).map((u) => this.forceHttps(u));
        // Casa "~large.jpg" mas também "~mobile.mp4"; o "_1" dos frames de
        // vídeo (~small_1.jpg) não pode ser confundido com o asset principal.
        const pick = (suffix: string, ext: string) =>
          list.find((u) => u.endsWith(`~${suffix}.${ext}`));

        if (mediaType === 'video') {
          return {
            // ~mobile (118 MB) < ~small (532 MB) < ~orig (1,4 GB): sempre o
            // menor disponível — e nunca pré-carregado (preload="none").
            videoUrl:
              pick('mobile', 'mp4') ?? pick('small', 'mp4') ?? pick('preview', 'mp4'),
            captionsUrl: list.find((u) => u.endsWith('.vtt')),
            originalUrl: pick('orig', 'mp4'),
          };
        }

        // Nem todo item traz todos os tamanhos: os antigos (PIA*) costumam ter
        // só ~orig e ~thumb. Por isso a cadeia inteira, do melhor equilíbrio
        // (~large, ~280 KB) até o ~orig, que pode passar de 10 MB e fica por
        // último — mas ainda é melhor que exibir o thumbnail esticado.
        const img = (s: string) =>
          pick(s, 'jpg') ?? pick(s, 'png') ?? pick(s, 'jpeg');
        return {
          displayUrl: img('large') ?? img('medium') ?? img('small') ?? img('orig'),
          originalUrl: img('orig'),
        };
      }),
    );
  }

  /** O manifest devolve URLs em http:// — numa página https vira mixed content. */
  private forceHttps(url: string): string {
    return url.startsWith('http://') ? 'https://' + url.slice(7) : url;
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

  private mapImages(res: ImageLibraryResponse): NasaMedia[] {
    const items = res.collection?.items ?? [];
    return items
      .map((item): NasaMedia | null => {
        const data = item.data?.[0];
        // Para vídeo, o link render=image é o frame de capa.
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
          thumbUrl: this.forceHttps(thumbUrl),
          mediaType: data.media_type === 'video' ? 'video' : 'image',
          collectionUrl: item.href,
        };
      })
      .filter((x): x is NasaMedia => x !== null);
  }
}
