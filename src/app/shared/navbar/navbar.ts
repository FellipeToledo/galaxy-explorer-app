import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { LANGS, Lang } from '../../core/i18n/translations';
import {
  GlassSelectComponent,
  SelectOption,
} from '../glass-select/glass-select';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, GlassSelectComponent],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class NavbarComponent {
  protected readonly translate = inject(TranslateService);

  /** Opções de idioma (bandeira + nome) para o dropdown glass. */
  protected readonly langOptions: SelectOption[] = LANGS.map((l) => ({
    label: `${l.flag} ${l.label}`,
    value: l.code,
  }));

  protected readonly currentLang = computed(() => this.translate.lang());

  protected onLangChange(value: string): void {
    this.translate.setLang(value as Lang);
  }
}
