import { Pipe, PipeTransform, inject } from '@angular/core';
import { ContentTranslateService } from './content-translate.service';

/**
 * Pipe `ct` — traduz texto dinâmico da API (títulos, descrições…) sob demanda,
 * com cache. Impuro para refletir a chegada assíncrona da tradução e a troca
 * de idioma.
 *
 * Uso: `{{ texto | ct }}` traduz tudo; `{{ texto | ct: 180 }}` manda só os
 * primeiros 180 caracteres para a API — para quando a UI já corta o texto
 * (cards com `line-clamp`), evitando pagar tradução de texto invisível.
 */
@Pipe({
  name: 'ct',
  standalone: true,
  pure: false,
})
export class ContentTranslatePipe implements PipeTransform {
  private readonly service = inject(ContentTranslateService);

  transform(text: string | undefined | null, maxLength?: number): string {
    // Lê o signal de versão para reagir quando novas traduções chegam.
    this.service.version();
    return this.service.translate(text ?? '', maxLength);
  }
}
