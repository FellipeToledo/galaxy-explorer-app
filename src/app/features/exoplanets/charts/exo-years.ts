import { Component, computed, inject, input, signal } from '@angular/core';
import { ExoYear } from '../../../core/models/exoplanet.model';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';

const W = 700;
const H = 260;
const PAD = { top: 18, right: 14, bottom: 34, left: 46 };
const MAX_BAR = 22;
const RADIUS = 4;
/** Espaço mínimo por rótulo de ano ("2026" ≈ 26px). */
const TICK_MIN_PX = 30;

interface Column {
  year: number;
  n: number;
  path: string;
  hitX: number;
  hitW: number;
  centerX: number;
  topY: number;
  showTick: boolean;
  labelValue: string | null;
}

/**
 * Descobertas de exoplanetas por ano. Uma série só → uma cor (a legenda seria
 * ruído: o título já diz o que é).
 */
@Component({
  selector: 'app-exo-years',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './exo-years.html',
  styleUrl: '../../../shared/charts/charts.scss',
})
export class ExoYearsComponent {
  protected readonly translate = inject(TranslateService);

  readonly data = input<ExoYear[]>([]);

  protected readonly viewW = W;
  protected readonly viewH = H;
  protected readonly plotBottom = H - PAD.bottom;
  protected readonly hovered = signal<Column | null>(null);

  private readonly yMax = computed(() => {
    const max = Math.max(1, ...this.data().map((d) => d.n));
    const step = this.tickStep(max);
    return Math.ceil(max / step) * step;
  });

  protected readonly yTicks = computed(() => {
    const max = this.yMax();
    const step = this.tickStep(max);
    const ticks: { value: number; y: number }[] = [];
    for (let v = 0; v <= max; v += step) {
      ticks.push({ value: v, y: this.yOf(v) });
    }
    return ticks;
  });

  protected readonly columns = computed<Column[]>(() => {
    const anos = this.data();
    if (!anos.length) {
      return [];
    }
    const plotW = W - PAD.left - PAD.right;
    const band = plotW / anos.length;
    const barW = Math.min(MAX_BAR, band * 0.6);
    const peak = Math.max(...anos.map((a) => a.n));
    const peakIsUnique = anos.filter((a) => a.n === peak).length === 1;
    // 34 anos em ~640px = ~19px por faixa: os rótulos precisam ralear.
    const stride = Math.max(1, Math.ceil(TICK_MIN_PX / band));
    const lastIdx = anos.length - 1;

    return anos.map((a, i) => {
      const hitX = PAD.left + band * i;
      const centerX = hitX + band / 2;
      const x = centerX - barW / 2;
      const top = this.yOf(a.n);
      return {
        year: a.disc_year,
        n: a.n,
        path: this.barPath(x, top, barW, this.plotBottom - top),
        hitX,
        hitW: band,
        centerX,
        topY: top,
        // O último ano sempre; os regulares só se não colarem nele.
        showTick: i === lastIdx || (i % stride === 0 && lastIdx - i >= stride),
        labelValue: peakIsUnique && a.n === peak ? String(a.n) : null,
      };
    });
  });

  protected readonly tipLeft = computed(() => {
    const c = this.hovered();
    return c ? (c.centerX / W) * 100 : 0;
  });
  protected readonly tipTop = computed(() => {
    const c = this.hovered();
    return c ? (c.topY / H) * 100 : 0;
  });

  protected hover(col: Column | null): void {
    this.hovered.set(col);
  }

  private yOf(value: number): number {
    const plotH = H - PAD.top - PAD.bottom;
    return this.plotBottom - (value / this.yMax()) * plotH;
  }

  private tickStep(max: number): number {
    const raw = Math.max(1, max) / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * mag;
  }

  /** Topo arredondado (4px), base quadrada na linha do eixo. */
  private barPath(x: number, y: number, w: number, h: number): string {
    const r = Math.min(RADIUS, h, w / 2);
    const bottom = y + h;
    return `M${x},${bottom} L${x},${y + r} Q${x},${y} ${x + r},${y}` +
      ` L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${bottom} Z`;
  }
}
