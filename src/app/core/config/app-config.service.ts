import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Config sobrescrevível em runtime por `public/config.json` (não versionado). */
export interface AppConfig {
  nasaApiKey: string;
  nasaApiBase: string;
  translateApiUrl: string;
  /** Nosso proxy para o Exoplanet Archive (ele não manda CORS). */
  exoplanetsApiUrl: string;
  /** Nosso proxy para o TechTransfer (CORS liberado só para o site deles). */
  techApiUrl: string;
}

/**
 * Configuração da aplicação carregada em runtime, no boot (APP_INITIALIZER).
 *
 * Valores padrão vêm do `environment`; se existir um `config.json` servido na
 * raiz (a partir de `public/config.json`, que é gitignored), ele sobrescreve —
 * ideal para a **chave da NASA** de cada dev, sem conflitar em `git pull` nem
 * arriscar commitar segredo. Em clone novo/produção sem o arquivo, usa os
 * padrões (DEMO_KEY).
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private config: AppConfig = {
    nasaApiKey: environment.nasaApiKey,
    nasaApiBase: environment.nasaApiBase,
    translateApiUrl: environment.translateApiUrl,
    exoplanetsApiUrl: environment.exoplanetsApiUrl,
    techApiUrl: environment.techApiUrl,
  };

  get nasaApiKey(): string {
    return this.config.nasaApiKey;
  }
  get nasaApiBase(): string {
    return this.config.nasaApiBase;
  }
  get translateApiUrl(): string {
    return this.config.translateApiUrl;
  }
  get exoplanetsApiUrl(): string {
    return this.config.exoplanetsApiUrl;
  }
  get techApiUrl(): string {
    return this.config.techApiUrl;
  }

  /** Busca `config.json` e mescla sobre os padrões. Nunca lança. */
  async load(): Promise<void> {
    try {
      // Relativo ao <base href> → respeita deploy em subpasta.
      const res = await fetch('config.json', { cache: 'no-cache' });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as Partial<AppConfig>;
      if (data && typeof data === 'object') {
        this.config = { ...this.config, ...data };
      }
    } catch {
      // Arquivo ausente/inválido → mantém os padrões do environment.
    }
  }
}
