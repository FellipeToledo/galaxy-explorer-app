import { Pipe, PipeTransform, inject } from '@angular/core';
import { ContentTranslateService } from './content-translate.service';

/**
 * Pipe `ct` — traduz texto dinâmico da API (títulos, descrições…) usando a
 * Translator API do navegador, sob demanda e com cache. Impuro para refletir
 * a chegada assíncrona da tradução e a troca de idioma.
 */
@Pipe({
  name: 'ct',
  standalone: true,
  pure: false,
})
export class ContentTranslatePipe implements PipeTransform {
  private readonly service = inject(ContentTranslateService);

  transform(text: string | undefined | null): string {
    // Lê o signal de versão para reagir quando novas traduções chegam.
    this.service.version();
    return this.service.translate(text ?? '');
  }
}
