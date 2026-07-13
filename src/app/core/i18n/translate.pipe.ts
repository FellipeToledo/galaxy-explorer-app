import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from './translate.service';

/**
 * Pipe `t` — traduz uma chave. Impuro para reagir à troca de idioma
 * (o TranslateService.lang é signal e muda em tempo real).
 */
@Pipe({
  name: 't',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(key: string, params?: Record<string, string | number>): string {
    return this.translate.t(key, params);
  }
}
