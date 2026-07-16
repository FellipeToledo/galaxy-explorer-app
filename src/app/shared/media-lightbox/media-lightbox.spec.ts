import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { MediaLightboxComponent } from './media-lightbox';
import { AppConfigService } from '../../core/config/app-config.service';
import { NasaMedia } from '../../core/models/media.model';

/**
 * Acessibilidade do modal. Isto regride em silêncio: nada na tela quebra
 * quando o Esc para de fechar ou o foco escapa para os cards de trás — só
 * quem usa teclado percebe.
 */
@Component({
  standalone: true,
  imports: [MediaLightboxComponent],
  template: `
    <button id="abridor">abrir</button>
    @if (aberto()) {
      <app-media-lightbox [item]="item" (close)="aberto.set(false)" />
    }
  `,
})
class HostComponent {
  readonly aberto = signal(false);
  item: NasaMedia = {
    nasaId: 'X',
    title: 'Uma foto de Marte',
    mediaType: 'image',
    thumbUrl: 'https://x/t.jpg',
    collectionUrl: 'https://x/collection.json',
  };
}

describe('MediaLightboxComponent — acessibilidade', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AppConfigService,
          useValue: { nasaApiKey: 'K', nasaApiBase: 'https://api.nasa.gov', translateApiUrl: '' },
        },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    // o manifest é buscado sob demanda ao abrir
    http.match('https://x/collection.json').forEach((r) => r.flush([]));
    http.verify();
  });

  /** Abre o modal como o app faz, com o foco vindo de um elemento real. */
  function abrir(): void {
    const abridor = fixture.nativeElement.querySelector('#abridor') as HTMLElement;
    abridor.focus();
    host.aberto.set(true);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement.querySelector('.lightbox') as HTMLElement;

  it('anuncia-se como janela, com nome', () => {
    abrir();
    expect(el().getAttribute('role')).toBe('dialog');
    expect(el().getAttribute('aria-modal')).toBe('true');
    expect(el().getAttribute('aria-label')).toBe('Uma foto de Marte');
  });

  it('leva o foco para dentro ao abrir (senão o Tab segue na página de trás)', () => {
    abrir();
    const fechar = fixture.nativeElement.querySelector('.close');
    expect(document.activeElement).toBe(fechar);
  });

  it('Esc fecha', () => {
    abrir();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(host.aberto()).toBeFalse();
  });

  it('devolve o foco a quem abriu', () => {
    const abridor = fixture.nativeElement.querySelector('#abridor');
    abrir();
    expect(document.activeElement).not.toBe(abridor);
    host.aberto.set(false);
    fixture.detectChanges();
    expect(document.activeElement)
      .withContext('sem isso o foco volta para o topo da página')
      .toBe(abridor);
  });

  it('Tab no último volta ao primeiro (o foco não escapa do modal)', () => {
    abrir();
    const focaveis = el().querySelectorAll<HTMLElement>('button, a[href]');
    const ultimo = focaveis[focaveis.length - 1];
    ultimo.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(focaveis[0]);
  });

  it('Shift+Tab no primeiro vai para o último', () => {
    abrir();
    const focaveis = el().querySelectorAll<HTMLElement>('button, a[href]');
    focaveis[0].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(focaveis[focaveis.length - 1]);
  });
});
