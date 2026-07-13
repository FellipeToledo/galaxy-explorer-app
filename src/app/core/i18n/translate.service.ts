import { Injectable, signal } from '@angular/core';
import {
  DEFAULT_LANG,
  Lang,
  TRANSLATIONS,
} from './translations';

const STORAGE_KEY = 'galaxy-explorer-lang';

/**
 * i18n leve baseado em signals. `lang` é um signal → templates que usam o
 * pipe `t` (impuro) reagem à troca de idioma sem recarregar a página.
 */
@Injectable({ providedIn: 'root' })
export class TranslateService {
  private readonly _lang = signal<Lang>(this.readInitial());
  readonly lang = this._lang.asReadonly();

  constructor() {
    this.applyDocumentLang(this._lang());
  }

  setLang(lang: Lang): void {
    if (!TRANSLATIONS[lang]) {
      return;
    }
    this._lang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* localStorage indisponível — ignora */
    }
    this.applyDocumentLang(lang);
  }

  /** Traduz uma chave, interpolando {{param}} quando fornecido. */
  t(key: string, params?: Record<string, string | number>): string {
    const dict = TRANSLATIONS[this._lang()] ?? {};
    let value = dict[key] ?? TRANSLATIONS[DEFAULT_LANG][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(
          new RegExp(`{{\\s*${k}\\s*}}`, 'g'),
          String(v),
        );
      }
    }
    return value;
  }

  private readInitial(): Lang {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved && TRANSLATIONS[saved]) {
        return saved;
      }
    } catch {
      /* ignora */
    }
    return DEFAULT_LANG;
  }

  private applyDocumentLang(lang: Lang): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }
}
