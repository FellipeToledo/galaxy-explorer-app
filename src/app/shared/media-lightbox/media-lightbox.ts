import { Component, computed, inject, input, output, signal } from '@angular/core';
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
export class MediaLightboxComponent {
  private readonly api = inject(NasaApiService);
  protected readonly translate = inject(TranslateService);

  readonly item = input.required<NasaMedia>();
  readonly close = output<void>();

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
