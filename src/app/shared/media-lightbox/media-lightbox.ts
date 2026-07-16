import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { NasaApiService } from '../../core/services/nasa-api.service';
import { MediaAssets, NasaMedia } from '../../core/models/media.model';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { ContentTranslatePipe } from '../../core/i18n/content-translate.pipe';

/**
 * Lightbox de imagem ou vídeo — compartilhado pelo Marte e pela Busca.
 *
 * Os arquivos grandes vêm do `collection.json`, buscado **sob demanda** ao
 * abrir: a imagem começa no thumb e é trocada pela versão grande quando chega;
 * o vídeo nunca é pré-carregado (ver `preload="none"` no template).
 */
@Component({
  selector: 'app-media-lightbox',
  standalone: true,
  imports: [DatePipe, TranslatePipe, ContentTranslatePipe],
  templateUrl: './media-lightbox.html',
  styleUrl: './media-lightbox.scss',
})
export class MediaLightboxComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(NasaApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly translate = inject(TranslateService);

  readonly item = input.required<NasaMedia>();
  readonly close = output<void>();

  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');
  /** Quem tinha o foco antes de abrir — para devolvê-lo ao fechar. */
  private previouslyFocused: HTMLElement | null = null;

  protected readonly assets = signal<MediaAssets | null>(null);
  protected readonly loading = signal(false);

  protected readonly isVideo = computed(() => this.item().mediaType === 'video');
  /** Melhor imagem disponível agora: a grande, ou o thumb enquanto carrega. */
  protected readonly imageSrc = computed(
    () => this.assets()?.displayUrl ?? this.item().thumbUrl,
  );

  constructor() {
    // input.required + constructor: o item já está definido no 1º effect.
    queueMicrotask(() => this.loadAssets());
    this.previouslyFocused = document.activeElement as HTMLElement | null;
  }

  ngAfterViewInit(): void {
    // Sem isso o foco fica no <body> e o Tab continua percorrendo os cards
    // ATRÁS do modal — quem usa teclado sai do lightbox sem perceber.
    this.closeBtn()?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    // Devolve o foco a quem abriu (o card), senão ele volta para o começo.
    this.previouslyFocused?.focus?.();
  }

  /** Esc fecha — é o que todo mundo tenta primeiro num modal. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close.emit();
  }

  /**
   * Prende o Tab dentro do modal (focus trap): sem isso o foco escapa para a
   * página de trás, que continua visível mas inerte.
   */
  @HostListener('document:keydown.tab', ['$event'])
  @HostListener('document:keydown.shift.tab', ['$event'])
  protected onTab(event: Event): void {
    const e = event as KeyboardEvent;
    const focaveis = this.host.nativeElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
    );
    if (!focaveis.length) {
      return;
    }
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    const atual = document.activeElement;
    const dentro = this.host.nativeElement.contains(atual);

    // Só intervém nas bordas do ciclo; no meio, o Tab nativo resolve.
    if (e.shiftKey && (atual === primeiro || !dentro)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && (atual === ultimo || !dentro)) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  private loadAssets(): void {
    const item = this.item();
    if (!item.collectionUrl) {
      return;
    }
    this.loading.set(true);
    this.api.getMediaAssets(item.collectionUrl, item.mediaType).subscribe({
      next: (assets) => {
        this.assets.set(assets);
        this.loading.set(false);
      },
      // Falhou? Fica o thumb — o lightbox não pode quebrar por causa disso.
      error: () => this.loading.set(false),
    });
  }
}
