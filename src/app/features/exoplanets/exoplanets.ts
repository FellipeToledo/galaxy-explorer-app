import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { NasaApiService } from '../../core/services/nasa-api.service';
import {
  ExoMethod,
  ExoYear,
  Exoplanet,
  LIGHT_YEARS_PER_PARSEC,
} from '../../core/models/exoplanet.model';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { ExoYearsComponent } from './charts/exo-years';
import { ExoMassRadiusComponent } from './charts/exo-mass-radius';

/**
 * 🪐 Exoplanetas — NASA Exoplanet Archive, via o nosso `/api/exoplanets`.
 *
 * Os quatro datasets vêm juntos (forkJoin): são consultas independentes e o
 * TAP leva ~2,5 s cada; em série, a página demoraria 10 s para aparecer.
 */
@Component({
  selector: 'app-exoplanets',
  standalone: true,
  imports: [
    DecimalPipe,
    TranslatePipe,
    ExoYearsComponent,
    ExoMassRadiusComponent,
  ],
  templateUrl: './exoplanets.html',
  styleUrl: './exoplanets.scss',
})
export class ExoplanetsComponent implements OnInit {
  private readonly api = inject(NasaApiService);
  protected readonly translate = inject(TranslateService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly years = signal<ExoYear[]>([]);
  protected readonly methods = signal<ExoMethod[]>([]);
  protected readonly massRadius = signal<Exoplanet[]>([]);
  protected readonly nearest = signal<Exoplanet[]>([]);

  // ── Stat tiles ──
  /** Total confirmado = soma das descobertas de todos os anos. */
  protected readonly total = computed(() =>
    this.years().reduce((acc, y) => acc + y.n, 0),
  );

  protected readonly thisYear = computed(() => {
    const atual = new Date().getFullYear();
    return this.years().find((y) => y.disc_year === atual)?.n ?? 0;
  });

  /** Método dominante e sua fatia — o "como achamos" da seção. */
  protected readonly topMethod = computed(() => {
    const [top] = this.methods();
    const total = this.methods().reduce((a, m) => a + m.n, 0);
    return top ? { name: top.discoverymethod, pct: (top.n / total) * 100 } : null;
  });

  /** O mais próximo da Terra (o dataset já vem ordenado por distância). */
  protected readonly closest = computed<Exoplanet | null>(
    () => this.nearest()[0] ?? null,
  );

  /** Parsec é a unidade do arquivo; ano-luz é o que as pessoas entendem. */
  protected lightYears(parsecs: number | null | undefined): number {
    return (parsecs ?? 0) * LIGHT_YEARS_PER_PARSEC;
  }

  ngOnInit(): void {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      years: this.api.getExoplanets<ExoYear>('byYear'),
      methods: this.api.getExoplanets<ExoMethod>('byMethod'),
      massRadius: this.api.getExoplanets<Exoplanet>('massRadius'),
      nearest: this.api.getExoplanets<Exoplanet>('nearest'),
    }).subscribe({
      next: ({ years, methods, massRadius, nearest }) => {
        this.years.set(years);
        this.methods.set(methods);
        this.massRadius.set(massRadius);
        this.nearest.set(nearest);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('exo.error');
        this.loading.set(false);
      },
    });
  }
}
