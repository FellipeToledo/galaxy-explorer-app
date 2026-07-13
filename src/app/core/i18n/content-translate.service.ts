import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from './translate.service';

/**
 * Traduz textos dinâmicos vindos da API da NASA (títulos, descrições,
 * explicações) usando a Translator API on-device do navegador (Chromium).
 *
 * Estratégia: sob demanda + cache. O texto-fonte é inglês; só traduz quando
 * o idioma escolhido não é inglês. Onde a API do navegador não existe, o
 * texto original é mostrado (degradação graciosa). A própria troca de
 * idioma funciona como "ver tradução / ver original".
 */
@Injectable({ providedIn: 'root' })
export class ContentTranslateService {
  private readonly ui = inject(TranslateService);

  private readonly cache = new Map<string, string>();
  private readonly pending = new Set<string>();
  private translator: { translate(t: string): Promise<string> } | null = null;
  private translatorTarget: string | null = null;

  /** Incrementa quando chega uma nova tradução → dispara atualização da view. */
  readonly version = signal(0);

  /** Código de destino a partir do idioma da UI (fonte = inglês). */
  private target(): string | null {
    return this.ui.lang() === 'pt-BR' ? 'pt' : null;
  }

  /**
   * Retorna a tradução em cache ou o texto original; se faltar, agenda a
   * tradução (assíncrona) e devolve o original enquanto isso.
   */
  translate(text: string): string {
    const target = this.target();
    if (!target || !text?.trim()) {
      return text;
    }
    const key = `${target}::${text}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    void this.schedule(text, target, key);
    return text;
  }

  private async schedule(
    text: string,
    target: string,
    key: string,
  ): Promise<void> {
    if (this.pending.has(key)) {
      return;
    }
    this.pending.add(key);
    try {
      const translator = await this.getTranslator(target);
      const out = translator ? await translator.translate(text) : text;
      this.cache.set(key, out);
      this.version.update((v) => v + 1);
    } catch {
      // Falhou → cacheia o original para não ficar re-tentando.
      this.cache.set(key, text);
    } finally {
      this.pending.delete(key);
    }
  }

  private async getTranslator(
    target: string,
  ): Promise<{ translate(t: string): Promise<string> } | null> {
    if (this.translator && this.translatorTarget === target) {
      return this.translator;
    }
    const g = globalThis as unknown as {
      Translator?: {
        create(opts: object): Promise<{ translate(t: string): Promise<string> }>;
        availability?(opts: object): Promise<string>;
      };
      translation?: {
        createTranslator(opts: object): Promise<{ translate(t: string): Promise<string> }>;
        canTranslate?(opts: object): Promise<string>;
      };
    };
    const opts = { sourceLanguage: 'en', targetLanguage: target };
    try {
      // API nova (Chrome estável): global Translator
      if (g.Translator?.create) {
        const avail = await g.Translator.availability?.(opts);
        if (avail === 'unavailable') {
          return null;
        }
        this.translator = await g.Translator.create(opts);
        this.translatorTarget = target;
        return this.translator;
      }
      // API antiga: self.translation
      if (g.translation?.createTranslator) {
        const can = await g.translation.canTranslate?.(opts);
        if (can === 'no') {
          return null;
        }
        this.translator = await g.translation.createTranslator(opts);
        this.translatorTarget = target;
        return this.translator;
      }
    } catch {
      return null;
    }
    return null;
  }
}
