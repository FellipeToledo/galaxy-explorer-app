import { Component, inject } from '@angular/core';
import { ContentTranslateService } from '../../core/i18n/content-translate.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/**
 * Chip discreto "traduzindo…" enquanto o conteúdo da API está sendo traduzido.
 *
 * Sem ele o app parece quebrado: o texto aparece em inglês e troca sozinho
 * segundos depois — ou, se a quota da DeepL estourou, simplesmente fica em
 * inglês, sem nada explicar por quê.
 */
@Component({
  selector: 'app-translating',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (content.translating()) {
      <div class="chip glass" role="status" aria-live="polite">
        <span class="dot" aria-hidden="true"></span>
        {{ 'common.translating' | t }}
      </div>
    }
  `,
  styleUrl: './translating.scss',
})
export class TranslatingComponent {
  protected readonly content = inject(ContentTranslateService);
}
