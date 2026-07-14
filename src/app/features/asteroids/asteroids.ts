import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NasaApiService } from '../../core/services/nasa-api.service';
import {
  NEO_RANGES,
  Neo,
  NeoDayCount,
  NeoRange,
} from '../../core/models/neo.model';
import {
  GlassSelectComponent,
  SelectOption,
} from '../../shared/glass-select/glass-select';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { NeoBarsComponent } from './charts/neo-bars';
import { NeoScatterComponent } from './charts/neo-scatter';

/** Janela máxima aceita pelo feed do NeoWs. */
const WINDOW_DAYS = 7;

/**
 * Dashboard de asteroides próximos da Terra (NeoWs).
 *
 * Um filtro de período no topo alimenta tudo: os stat tiles, os dois gráficos
 * e a tabela — que é a leitura acessível dos mesmos dados (nenhum valor fica
 * preso no tooltip).
 */
@Component({
  selector: 'app-asteroids',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    GlassSelectComponent,
    TranslatePipe,
    NeoBarsComponent,
    NeoScatterComponent,
  ],
  templateUrl: './asteroids.html',
  styleUrl: './asteroids.scss',
})
export class AsteroidsComponent implements OnInit {
  private readonly api = inject(NasaApiService);
  protected readonly translate = inject(TranslateService);

  protected readonly neos = signal<Neo[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly range = signal<NeoRange>('next7');

  protected readonly rangeOptions = computed<SelectOption[]>(() =>
    NEO_RANGES.map((r) => ({ label: this.translate.t('neo.range.' + r), value: r })),
  );

  // ── Stat tiles ──
  protected readonly total = computed(() => this.neos().length);
  protected readonly hazardousCount = computed(
    () => this.neos().filter((n) => n.hazardous).length,
  );
  protected readonly closest = computed<Neo | null>(() => {
    const list = this.neos();
    return list.length ? list.reduce((a, b) => (a.missKm <= b.missKm ? a : b)) : null;
  });
  protected readonly fastest = computed<Neo | null>(() => {
    const list = this.neos();
    return list.length
      ? list.reduce((a, b) => (a.velocityKph >= b.velocityKph ? a : b))
      : null;
  });

  /** Contagem por dia para o gráfico de colunas (dias vazios incluídos). */
  protected readonly dayCounts = computed<NeoDayCount[]>(() => {
    const byDate = new Map<string, NeoDayCount>();
    for (const date of this.rangeDates()) {
      byDate.set(date, { date, hazardous: 0, safe: 0, total: 0 });
    }
    for (const neo of this.neos()) {
      const day = byDate.get(neo.approachDate);
      if (!day) {
        continue;
      }
      neo.hazardous ? day.hazardous++ : day.safe++;
      day.total++;
    }
    return [...byDate.values()];
  });

  ngOnInit(): void {
    this.load();
  }

  protected onRangeChange(value: string): void {
    this.range.set(value as NeoRange);
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    const dates = this.rangeDates();
    this.api.getNeoFeed(dates[0], dates[dates.length - 1]).subscribe({
      next: (list) => {
        this.neos.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('neo.error');
        this.loading.set(false);
      },
    });
  }

  /** Todas as datas (YYYY-MM-DD) do período selecionado, em ordem. */
  private rangeDates(): string[] {
    const range = this.range();
    const days = range === 'today' ? 1 : WINDOW_DAYS;
    // 'last7' termina hoje; 'next7'/'today' começam hoje.
    const start = new Date();
    if (range === 'last7') {
      start.setDate(start.getDate() - (WINDOW_DAYS - 1));
    }
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return this.toIso(d);
    });
  }

  /** YYYY-MM-DD no fuso local (toISOString usaria UTC e podia pular um dia). */
  private toIso(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
}
