import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from './translate.service';

/**
 * Título da aba seguindo o idioma da UI.
 *
 * As rotas declaram uma **chave** de tradução em `title` (ex.: `title.mars`),
 * não o texto pronto — antes era pt-BR fixo e não mudava com o seletor.
 *
 * Só reagir à navegação não basta: trocar o idioma não navega. Por isso o
 * último título é lembrado e um `effect` o reaplica quando `lang` muda.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);

  /** Chave da rota atual (null antes da 1ª navegação). */
  private currentKey: string | null = null;

  constructor() {
    super();
    effect(() => {
      // Depende de lang() → reaplica o título ao trocar de idioma.
      this.translate.lang();
      if (this.currentKey) {
        this.title.setTitle(this.compose(this.currentKey));
      }
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot);
    this.currentKey = key ?? null;
    this.title.setTitle(key ? this.compose(key) : this.translate.t('app.name'));
  }

  /** "Galaxy Explorer · <seção>" */
  private compose(key: string): string {
    return `${this.translate.t('app.name')} · ${this.translate.t(key)}`;
  }
}
