import { Component, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NasaMedia } from '../../core/models/media.model';
import { InViewDirective } from '../in-view/in-view';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { ContentTranslatePipe } from '../../core/i18n/content-translate.pipe';

/**
 * Card neon de um item de mídia — compartilhado pelo Marte e pela Busca.
 *
 * Regras do card (ver CLAUDE.md, não re-litigar): a borda cônica gira só com
 * `.in-view` (perf com 100 cards) e **nunca** usar `content-visibility:auto`
 * aqui (recorta a borda). A descrição usa `ct` com limite: o texto é cortado
 * em 2 linhas e traduzir o resto queima a quota da DeepL à toa.
 */
@Component({
  selector: 'app-media-card',
  standalone: true,
  imports: [DatePipe, InViewDirective, TranslatePipe, ContentTranslatePipe],
  templateUrl: './media-card.html',
  styleUrl: './media-card.scss',
})
export class MediaCardComponent {
  protected readonly translate = inject(TranslateService);

  readonly item = input.required<NasaMedia>();
  /** Rótulo da tarja superior do card ("Marte", "Mídia"…). */
  readonly brand = input<string>('');
  /** Índice na grade → tema de cor (ciclo de 4). */
  readonly index = input<number>(0);

  readonly open = output<NasaMedia>();

  protected readonly theme = computed(() => this.index() % 4);
  protected readonly isVideo = computed(() => this.item().mediaType === 'video');
}
