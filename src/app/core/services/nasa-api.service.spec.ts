import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { NasaApiService } from './nasa-api.service';
import { AppConfigService } from '../config/app-config.service';

/**
 * Testes das regras que só descobrimos MEDINDO a API — as mesmas do
 * "não re-litigar" no CLAUDE.md. Elas não são óbvias no código e um refactor
 * bem-intencionado as quebraria sem perceber.
 */
describe('NasaApiService', () => {
  let api: NasaApiService;
  let http: HttpTestingController;
  const BASE = 'https://api.nasa.gov';
  const IMG = 'https://images-api.nasa.gov';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AppConfigService,
          useValue: { nasaApiKey: 'CHAVE_TESTE', nasaApiBase: BASE },
        },
      ],
    });
    api = TestBed.inject(NasaApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('searchImages', () => {
    it('omite q quando o termo é vazio (a API filtra só por ano/tipo)', () => {
      api.searchImages('', 1, '2020', '2020', 'image').subscribe();
      const req = http.expectOne((r) => r.url === `${IMG}/search`);
      expect(req.request.params.has('q')).toBeFalse();
      expect(req.request.params.get('year_start')).toBe('2020');
      req.flush({ collection: { items: [] } });
    });

    it('manda q quando há termo, sem espaços nas pontas', () => {
      api.searchImages('  Apollo 11  ').subscribe();
      const req = http.expectOne((r) => r.url === `${IMG}/search`);
      expect(req.request.params.get('q')).toBe('Apollo 11');
      req.flush({ collection: { items: [] } });
    });

    it('repassa o media_type pedido', () => {
      api.searchImages('x', 1, undefined, undefined, 'image,video').subscribe();
      const req = http.expectOne((r) => r.url === `${IMG}/search`);
      expect(req.request.params.get('media_type')).toBe('image,video');
      req.flush({ collection: { items: [] } });
    });

    it('marca vídeo pelo media_type e força https no thumb', () => {
      let out: any[] = [];
      api.searchImages('x').subscribe((r) => (out = r));
      http.expectOne((r) => r.url === `${IMG}/search`).flush({
        collection: {
          items: [
            {
              href: 'https://images-assets.nasa.gov/video/A/collection.json',
              data: [{ nasa_id: 'A', title: 'Um vídeo', media_type: 'video' }],
              // a API devolve http:// → mixed content em produção
              links: [{ href: 'http://images-assets.nasa.gov/video/A/A~thumb.jpg', render: 'image' }],
            },
          ],
        },
      });
      expect(out.length).toBe(1);
      expect(out[0].mediaType).toBe('video');
      expect(out[0].thumbUrl.startsWith('https://')).toBeTrue();
      expect(out[0].collectionUrl).toContain('collection.json');
    });

    it('descarta item sem nasa_id ou sem thumb (não renderiza card quebrado)', () => {
      let out: any[] = [];
      api.searchImages('x').subscribe((r) => (out = r));
      http.expectOne((r) => r.url === `${IMG}/search`).flush({
        collection: {
          items: [
            { data: [{ title: 'sem id' }], links: [{ href: 'https://x/t.jpg', render: 'image' }] },
            { data: [{ nasa_id: 'B', title: 'sem thumb' }], links: [] },
          ],
        },
      });
      expect(out).toEqual([]);
    });
  });

  describe('getMediaAssets', () => {
    const manifest = (urls: string[]) => {
      let out: any = null;
      api.getMediaAssets('https://x/collection.json', 'image').subscribe((a) => (out = a));
      http.expectOne('https://x/collection.json').flush(urls);
      return out;
    };

    it('prefere ~large (o ~orig passa de 10 MB)', () => {
      const a = manifest([
        'http://x/a~orig.jpg',
        'http://x/a~large.jpg',
        'http://x/a~medium.jpg',
        'http://x/a~thumb.jpg',
      ]);
      expect(a.displayUrl).toContain('~large.jpg');
      expect(a.originalUrl).toContain('~orig.jpg');
    });

    it('cai para medium → small → orig quando falta o large', () => {
      expect(manifest(['http://x/a~orig.jpg', 'http://x/a~medium.jpg']).displayUrl)
        .toContain('~medium.jpg');
      expect(manifest(['http://x/a~orig.jpg', 'http://x/a~small.jpg']).displayUrl)
        .toContain('~small.jpg');
      // itens antigos (PIA*) só têm orig e thumb
      expect(manifest(['http://x/a~orig.jpg', 'http://x/a~thumb.jpg']).displayUrl)
        .toContain('~orig.jpg');
    });

    it('força https (senão é mixed content bloqueado em produção)', () => {
      const a = manifest(['http://x/a~large.jpg', 'http://x/a~orig.jpg']);
      expect(a.displayUrl.startsWith('https://')).toBeTrue();
      expect(a.originalUrl.startsWith('https://')).toBeTrue();
    });

    it('vídeo: pega o ~mobile (118 MB) e não o ~orig (1,4 GB)', () => {
      let out: any = null;
      api.getMediaAssets('https://x/collection.json', 'video').subscribe((a) => (out = a));
      http.expectOne('https://x/collection.json').flush([
        'http://x/v~orig.mp4',
        'http://x/v~small.mp4',
        'http://x/v~mobile.mp4',
        'http://x/v.vtt',
        // frames de preview do vídeo: não podem virar o arquivo principal
        'http://x/v~small_1.jpg',
        'http://x/v~thumb.jpg',
      ]);
      expect(out.videoUrl).toContain('~mobile.mp4');
      expect(out.captionsUrl).toContain('.vtt');
      expect(out.originalUrl).toContain('~orig.mp4');
    });

    it('vídeo sem mobile cai para small', () => {
      let out: any = null;
      api.getMediaAssets('https://x/collection.json', 'video').subscribe((a) => (out = a));
      http.expectOne('https://x/collection.json').flush([
        'http://x/v~orig.mp4',
        'http://x/v~small.mp4',
      ]);
      expect(out.videoUrl).toContain('~small.mp4');
    });
  });

  describe('getNeoFeed', () => {
    it('casa a aproximação com o dia do grupo (o feed repete todas)', () => {
      let out: any[] = [];
      api.getNeoFeed('2026-01-01', '2026-01-02').subscribe((r) => (out = r));
      http.expectOne((r) => r.url === `${BASE}/neo/rest/v1/feed`).flush({
        near_earth_objects: {
          '2026-01-02': [
            {
              id: '1',
              name: '(2026 AA)',
              is_potentially_hazardous_asteroid: true,
              estimated_diameter: { meters: { estimated_diameter_min: 10, estimated_diameter_max: 30 } },
              close_approach_data: [
                // a 1ª é de OUTRO dia: usar ela seria o bug
                {
                  close_approach_date: '2026-01-01',
                  miss_distance: { kilometers: '999', lunar: '9' },
                  relative_velocity: { kilometers_per_hour: '111' },
                },
                {
                  close_approach_date: '2026-01-02',
                  miss_distance: { kilometers: '5000', lunar: '1.3' },
                  relative_velocity: { kilometers_per_hour: '40000' },
                },
              ],
            },
          ],
        },
      });
      expect(out.length).toBe(1);
      expect(out[0].approachDate).toBe('2026-01-02');
      expect(out[0].missKm).toBe(5000); // da aproximação do dia certo
      expect(out[0].velocityKph).toBe(40000);
    });

    it('limpa os parênteses do nome e calcula a média do diâmetro', () => {
      let out: any[] = [];
      api.getNeoFeed('2026-01-01', '2026-01-01').subscribe((r) => (out = r));
      http.expectOne((r) => r.url === `${BASE}/neo/rest/v1/feed`).flush({
        near_earth_objects: {
          '2026-01-01': [
            {
              id: '2',
              name: '(2026 BB)',
              estimated_diameter: { meters: { estimated_diameter_min: 100, estimated_diameter_max: 200 } },
              close_approach_data: [
                { close_approach_date: '2026-01-01', miss_distance: { kilometers: '1', lunar: '1' }, relative_velocity: { kilometers_per_hour: '1' } },
              ],
            },
          ],
        },
      });
      expect(out[0].name).toBe('2026 BB');
      expect(out[0].diameterAvg).toBe(150);
      expect(out[0].hazardous).toBeFalse(); // ausente = não perigoso
    });

    it('achata os dias em uma lista, ordenada por distância', () => {
      let out: any[] = [];
      api.getNeoFeed('2026-01-01', '2026-01-02').subscribe((r) => (out = r));
      const neo = (id: string, dia: string, km: string) => ({
        id,
        name: id,
        estimated_diameter: { meters: { estimated_diameter_min: 1, estimated_diameter_max: 2 } },
        close_approach_data: [
          { close_approach_date: dia, miss_distance: { kilometers: km, lunar: '1' }, relative_velocity: { kilometers_per_hour: '1' } },
        ],
      });
      http.expectOne((r) => r.url === `${BASE}/neo/rest/v1/feed`).flush({
        near_earth_objects: {
          '2026-01-01': [neo('longe', '2026-01-01', '900000')],
          '2026-01-02': [neo('perto', '2026-01-02', '1000')],
        },
      });
      expect(out.map((n) => n.id)).toEqual(['perto', 'longe']);
    });

    it('ignora objeto sem diâmetro ou sem aproximação', () => {
      let out: any[] = [];
      api.getNeoFeed('2026-01-01', '2026-01-01').subscribe((r) => (out = r));
      http.expectOne((r) => r.url === `${BASE}/neo/rest/v1/feed`).flush({
        near_earth_objects: {
          '2026-01-01': [
            { id: 'x', name: 'sem diametro', close_approach_data: [{ close_approach_date: '2026-01-01' }] },
            { id: 'y', name: 'sem aproximacao', estimated_diameter: { meters: { estimated_diameter_min: 1, estimated_diameter_max: 2 } } },
          ],
        },
      });
      expect(out).toEqual([]);
    });
  });

  describe('EPIC', () => {
    it('deriva a URL do arquivo a partir da data e inclui a chave', () => {
      let out: any[] = [];
      api.getEpicImages('2026-07-14').subscribe((r) => (out = r));
      const req = http.expectOne((r) => r.url === `${BASE}/EPIC/api/natural/date/2026-07-14`);
      expect(req.request.params.get('api_key')).toBe('CHAVE_TESTE');
      req.flush([
        {
          identifier: '1',
          image: 'epic_1b_2026',
          caption: 'Terra',
          date: '2026-07-14 00:29:32',
          centroid_coordinates: { lat: -1.5, lon: 20 },
        },
      ]);
      // /archive/natural/YYYY/MM/DD/{jpg|png}/<image>.{jpg|png}
      expect(out[0].imageUrl).toContain('/EPIC/archive/natural/2026/07/14/jpg/epic_1b_2026.jpg');
      expect(out[0].pngUrl).toContain('/EPIC/archive/natural/2026/07/14/png/epic_1b_2026.png');
      expect(out[0].imageUrl).toContain('api_key=CHAVE_TESTE'); // o arquivo exige chave
    });

    it('converte a data em ISO válido (a API manda espaço, e é UTC)', () => {
      let out: any[] = [];
      api.getEpicImages().subscribe((r) => (out = r));
      http.expectOne((r) => r.url === `${BASE}/EPIC/api/natural`).flush([
        { identifier: '1', image: 'x', date: '2026-07-14 00:29:32' },
      ]);
      expect(out[0].dateIso).toBe('2026-07-14T00:29:32Z');
      expect(isNaN(Date.parse(out[0].dateIso))).toBeFalse();
    });

    it('ordena os quadros por hora (o slider depende disso)', () => {
      let out: any[] = [];
      api.getEpicImages().subscribe((r) => (out = r));
      http.expectOne((r) => r.url === `${BASE}/EPIC/api/natural`).flush([
        { identifier: 'b', image: 'b', date: '2026-07-14 10:00:00' },
        { identifier: 'a', image: 'a', date: '2026-07-14 08:00:00' },
      ]);
      expect(out.map((i) => i.identifier)).toEqual(['a', 'b']);
    });

    it('datas disponíveis vêm da mais recente para trás', () => {
      let out: string[] = [];
      api.getEpicDates().subscribe((r) => (out = r));
      http.expectOne((r) => r.url === `${BASE}/EPIC/api/natural/available`)
        .flush(['2015-06-13', '2026-07-14', '2020-01-01']);
      expect(out[0]).toBe('2026-07-14');
      expect(out.at(-1)).toBe('2015-06-13');
    });
  });

  describe('suggest', () => {
    it('corta títulos longos na pontuação e não repete o termo buscado', () => {
      let out: string[] = [];
      api.suggest('crater').subscribe((r) => (out = r));
      http.expectOne((r) => r.url === `${IMG}/search`).flush({
        collection: {
          items: [
            { data: [{ title: 'Gale Crater, Mars — close up' }] },
            { data: [{ title: 'Have a Nice Spring! MOC Revisits' }] },
            { data: [{ title: 'crater' }] }, // = ao termo: sai
            { data: [{ title: 'Gale Crater' }] }, // duplicata (case-insensitive)
            { data: [{ title: 'Gale Crater' }] },
          ],
        },
      });
      expect(out).toEqual(['Gale Crater', 'Have a Nice Spring']);
    });
  });
});
