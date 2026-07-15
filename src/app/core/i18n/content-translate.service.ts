import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from './translate.service';
import { AppConfigService } from '../config/app-config.service';

/**
 * Traduz textos dinâmicos vindos da API da NASA (títulos, descrições,
 * explicações) sob demanda, com cache.
 *
 * Estratégia em camadas:
 *   1. Backend proxy (environment.translateApiUrl → DeepL) em lote — robusto,
 *      funciona em qualquer navegador. É o caminho primário.
 *   2. Se o backend falhar, cai para a Translator API on-device do navegador.
 *   3. Se nenhuma existir, mostra o texto original.
 *
 * A fonte é inglês; só traduz quando o idioma da UI não é inglês. A própria
 * troca de idioma funciona como "ver tradução / ver original".
 */
@Injectable({ providedIn: 'root' })
export class ContentTranslateService {
  private readonly ui = inject(TranslateService);
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly apiUrl = this.appConfig.translateApiUrl;
  /** Fica true se o backend falhar → passa a usar a API do navegador. */
  private backendDown = false;

  private readonly cache = new Map<string, string>();

  /** Incrementa quando chega tradução nova → atualiza a view (pipe impuro). */
  readonly version = signal(0);

  // Fila de lote para o backend
  private readonly queuedKeys = new Set<string>();
  private queuedTexts: string[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  // Translator API do navegador
  private readonly pending = new Set<string>();
  private translator: { translate(t: string): Promise<string> } | null = null;
  private translatorTarget: string | null = null;

  /** Código de destino a partir do idioma da UI (fonte = inglês). */
  private target(): string | null {
    return this.ui.lang() === 'pt-BR' ? 'pt' : null;
  }

  /**
   * Encurta o texto antes de mandar traduzir.
   *
   * As descrições da NASA têm ~615 chars, mas o card mostra 2 linhas
   * (`-webkit-line-clamp`) — traduzir o resto é pagar por texto que ninguém lê,
   * e a quota free da DeepL (500k/mês) morria em ~8 páginas do Marte. O corte
   * é na fronteira de palavra: um texto cortado no meio traduz mal.
   */
  private clip(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    const cut = text.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    // Sem espaço perto do fim (palavra gigante/CJK): corta seco mesmo.
    return (lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
  }

  /**
   * Tradução em cache ou original; agenda a tradução quando faltar.
   *
   * `maxLength` limita o que vai para a API — use nos textos que a UI já corta.
   * Sem ele, traduz o texto inteiro (lightbox, explicação do APOD…).
   */
  translate(text: string, maxLength?: number): string {
    const target = this.target();
    if (!target || !text?.trim()) {
      return text;
    }
    if (maxLength && maxLength > 0) {
      text = this.clip(text, maxLength);
    }
    const key = `${target}::${text}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    if (this.apiUrl && !this.backendDown) {
      this.enqueue(text, key);
    } else {
      void this.browserTranslate(text, target, key);
    }
    return text;
  }

  // ── Caminho 1: backend em lote ──────────────────────────────────────────
  private enqueue(text: string, key: string): void {
    if (this.queuedKeys.has(key)) {
      return;
    }
    this.queuedKeys.add(key);
    this.queuedTexts.push(text);
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 60);
    }
  }

  private flush(): void {
    this.flushTimer = null;
    const target = this.target();
    const texts = this.queuedTexts;
    this.queuedTexts = [];
    this.queuedKeys.clear();
    if (!target || texts.length === 0) {
      return;
    }

    this.http
      .post<{ translations: string[] }>(this.apiUrl, {
        q: texts,
        target,
        source: 'en',
      })
      .subscribe({
        next: (res) => {
          const out = res?.translations ?? [];
          texts.forEach((text, i) => {
            this.cache.set(`${target}::${text}`, out[i] ?? text);
          });
          this.version.update((v) => v + 1);
        },
        error: () => {
          // Backend indisponível → usa a API do navegador daqui pra frente.
          this.backendDown = true;
          for (const text of texts) {
            void this.browserTranslate(text, target, `${target}::${text}`);
          }
        },
      });
  }

  // ── Caminho 2: Translator API do navegador ──────────────────────────────
  private async browserTranslate(
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
      if (g.Translator?.create) {
        const avail = await g.Translator.availability?.(opts);
        if (avail === 'unavailable') {
          return null;
        }
        this.translator = await g.Translator.create(opts);
        this.translatorTarget = target;
        return this.translator;
      }
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
