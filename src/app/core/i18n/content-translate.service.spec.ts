import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ContentTranslateService } from './content-translate.service';
import { TranslateService } from './translate.service';
import { AppConfigService } from '../config/app-config.service';

/**
 * O `clip` é o que segura a quota da DeepL: 1 página do Marte custava 65.676
 * chars (descrição média de 615) e o card mostra 2 linhas. Se estes testes
 * quebrarem, a quota mensal volta a durar ~8 páginas.
 */
describe('ContentTranslateService', () => {
  let service: ContentTranslateService;
  let http: HttpTestingController;
  let ui: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AppConfigService,
          useValue: { translateApiUrl: '/api/translate' },
        },
      ],
    });
    ui = TestBed.inject(TranslateService);
    ui.setLang('pt-BR'); // fonte é inglês: só traduz fora do inglês
    service = TestBed.inject(ContentTranslateService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Espera o lote (debounce de 60ms) e devolve o que foi enviado à API. */
  function flushBatch(respostas?: string[]): string[] {
    jasmine.clock().tick(100);
    const req = http.expectOne('/api/translate');
    const enviados = req.request.body.q as string[];
    req.flush({ translations: respostas ?? enviados.map((t) => `«${t}»`) });
    return enviados;
  }

  beforeEach(() => jasmine.clock().install());
  afterEach(() => jasmine.clock().uninstall());

  it('devolve o texto original enquanto a tradução não chega', () => {
    expect(service.translate('Mars rover')).toBe('Mars rover');
    flushBatch();
  });

  it('em inglês não traduz nada (a fonte já é inglês)', () => {
    ui.setLang('en-US');
    expect(service.translate('Mars rover')).toBe('Mars rover');
    jasmine.clock().tick(100);
    http.expectNone('/api/translate'); // nem chega a chamar a API
  });

  it('manda ao backend só os primeiros N chars quando há limite', () => {
    const longo = 'A'.repeat(50) + ' ' + 'B'.repeat(400);
    service.translate(longo, 160);
    const [enviado] = flushBatch();
    expect(enviado.length).toBeLessThanOrEqual(161); // 160 + reticência
    expect(longo.length).toBe(451); // o original é bem maior
  });

  it('sem limite, manda o texto inteiro (lightbox)', () => {
    const longo = 'palavra '.repeat(100).trim();
    service.translate(longo);
    const [enviado] = flushBatch();
    expect(enviado).toBe(longo);
  });

  it('corta na fronteira de palavra, não no meio', () => {
    const texto =
      'The Perseverance rover captured this image of the Jezero Crater delta';
    service.translate(texto, 40);
    const [enviado] = flushBatch();
    expect(enviado.endsWith('…')).toBeTrue();
    // sem palavra partida: o trecho antes da reticência bate com o original
    const semReticencia = enviado.slice(0, -1);
    expect(texto.startsWith(semReticencia)).toBeTrue();
    expect(semReticencia.endsWith(' ')).toBeFalse();
  });

  it('texto menor que o limite passa intacto, sem reticência', () => {
    service.translate('Mars rover', 160);
    const [enviado] = flushBatch();
    expect(enviado).toBe('Mars rover');
  });

  it('palavra gigante sem espaço é cortada seco (não trava)', () => {
    const gigante = 'A'.repeat(300);
    service.translate(gigante, 40);
    const [enviado] = flushBatch();
    expect(enviado).toBe('A'.repeat(40) + '…');
  });

  it('agrupa textos num lote só (economiza requisição)', () => {
    service.translate('Mars');
    service.translate('Earth');
    service.translate('Moon');
    const enviados = flushBatch();
    expect(enviados).toEqual(['Mars', 'Earth', 'Moon']);
  });

  it('não repete no lote o mesmo texto', () => {
    service.translate('Mars');
    service.translate('Mars');
    const enviados = flushBatch();
    expect(enviados).toEqual(['Mars']);
  });

  it('depois de traduzir, devolve do cache sem nova requisição', () => {
    service.translate('Mars');
    flushBatch(['«Mars»']);
    expect(service.translate('Mars')).toBe('«Mars»');
    jasmine.clock().tick(100);
    http.expectNone('/api/translate');
  });

  it('o mesmo texto com limites diferentes são entradas distintas', () => {
    const texto = 'palavra '.repeat(60).trim();
    service.translate(texto, 100);
    flushBatch();
    // o lightbox pede o texto inteiro: precisa ir para a API de novo
    service.translate(texto);
    const [enviado] = flushBatch();
    expect(enviado).toBe(texto);
  });

  it('texto vazio ou só espaços não vai para a API', () => {
    expect(service.translate('')).toBe('');
    expect(service.translate('   ')).toBe('   ');
    jasmine.clock().tick(100);
    http.expectNone('/api/translate');
  });

  it('indicador "traduzindo" liga na fila e desliga ao chegar', async () => {
    // Timers reais: o contador sobe num queueMicrotask (para não escrever em
    // signal durante o render — NG0600), e microtask + clock falso não se
    // misturam.
    jasmine.clock().uninstall();
    try {
      expect(service.translating()).toBeFalse();
      service.translate('Mars');
      await Promise.resolve();
      expect(service.translating())
        .withContext('deve ligar assim que entra na fila')
        .toBeTrue();

      await new Promise((r) => setTimeout(r, 100)); // debounce do lote
      http.expectOne('/api/translate').flush({ translations: ['«Mars»'] });
      await Promise.resolve();
      expect(service.translating())
        .withContext('deve desligar quando a tradução chega')
        .toBeFalse();
    } finally {
      jasmine.clock().install(); // o afterEach global desinstala
    }
  });
});
