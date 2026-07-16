import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { EarthComponent } from './earth';
import { AppConfigService } from '../../core/config/app-config.service';

/**
 * O arquivo do EPIC é esburacado (3.566 datas em ~11 anos; 2019 tem só 172
 * dias). `nearestDate` é o que impede que escolher uma data sem imagem vire
 * tela vazia — o motivo de o campo aceitar qualquer data do intervalo.
 */
describe('EarthComponent — datas do arquivo', () => {
  let comp: EarthComponent;
  let http: HttpTestingController;
  const BASE = 'https://api.nasa.gov';

  /** Recorte real do /available: 2019-06-03 e 2019-06-06 NÃO existem. */
  const DATAS = [
    '2015-06-13',
    '2019-06-01',
    '2019-06-02',
    '2019-06-04',
    '2019-06-05',
    '2019-06-07',
    '2026-07-14',
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EarthComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AppConfigService,
          useValue: { nasaApiKey: 'K', nasaApiBase: BASE, translateApiUrl: '' },
        },
      ],
    });
    const fixture = TestBed.createComponent(EarthComponent);
    comp = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);

    fixture.detectChanges(); // dispara o ngOnInit → carrega as datas
    http.expectOne((r) => r.url === `${BASE}/EPIC/api/natural/available`).flush(DATAS);
    // o componente já pede as imagens da data mais recente
    http.expectOne((r) => r.url.includes('/EPIC/api/natural')).flush([]);
  });

  afterEach(() => http.verify());

  /** `nearestDate` é privado: acesso por índice é o padrão em teste. */
  const nearest = (d: string) => (comp as any)['nearestDate'](d);

  it('usa o arquivo inteiro, não uma fatia (min/max reais)', () => {
    expect((comp as any).dates().length).toBe(DATAS.length);
    expect((comp as any).maxDate()).toBe('2026-07-14');
    expect((comp as any).minDate).toBe('2015-06-13');
  });

  it('começa na data mais recente', () => {
    expect((comp as any).date()).toBe('2026-07-14');
  });

  it('data existente é mantida', () => {
    expect(nearest('2019-06-04')).toBe('2019-06-04');
  });

  it('data sem imagem pula para a vizinha, preferindo a mais recente no empate', () => {
    // buraco real do arquivo: 02 e 04 estão a 1 dia de 03 → desempata na frente
    expect(nearest('2019-06-03')).toBe('2019-06-04');
    expect(nearest('2019-06-06')).toBe('2019-06-07');
  });

  it('sem empate, vai para a vizinha mais perto — mesmo que seja para trás', () => {
    // 2019-06-08: a única vizinha é 07 (o próximo salta para 2026)
    expect(nearest('2019-06-08')).toBe('2019-06-07');
  });

  it('data anterior ao arquivo cai na primeira', () => {
    expect(nearest('2000-01-01')).toBe('2015-06-13');
  });

  it('data futura cai na última', () => {
    expect(nearest('2030-01-01')).toBe('2026-07-14');
  });

  it('data inválida não quebra', () => {
    expect(nearest('nao-e-data')).toBeNull();
  });

  it('avisa quando ajustou, e só quando ajustou', () => {
    (comp as any).onDateChange('2019-06-03'); // não existe → vira 06-04
    http.expectOne((r) => r.url.includes('/EPIC/api/natural/date/2019-06-04')).flush([]);
    expect((comp as any).date()).toBe('2019-06-04');
    expect((comp as any).adjustedFrom())
      .withContext('a data PEDIDA precisa aparecer no aviso')
      .toBe('2019-06-03');

    (comp as any).onDateChange('2019-06-05'); // existe → sem aviso
    http.expectOne((r) => r.url.includes('/EPIC/api/natural/date/2019-06-05')).flush([]);
    expect((comp as any).adjustedFrom())
      .withContext('data válida não deve manter o aviso')
      .toBeNull();
  });

  it('campo limpo não dispara busca', () => {
    (comp as any).onDateChange('');
    http.expectNone((r) => r.url.includes('/EPIC/api/natural/date/'));
  });
});
