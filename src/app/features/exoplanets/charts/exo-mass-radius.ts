import { Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  Exoplanet,
  SOLAR_REFERENCES,
} from '../../../core/models/exoplanet.model';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';

const W = 700;
const H = 300;
const PAD = { top: 18, right: 18, bottom: 42, left: 54 };
const DOT_R = 4;
/** Referência do Sistema Solar: maior que o ponto comum, para se destacar. */
const REF_R = 6;

interface Dot {
  planet: Exoplanet;
  cx: number;
  cy: number;
}
interface RefDot {
  name: string;
  cx: number;
  cy: number;
}

/**
 * Diagrama massa × raio — o gráfico clássico de exoplanetas.
 *
 * Log nos dois eixos porque a faixa é absurda (massa de 0,3 a 8.654 vezes a
 * Terra; raio de 0,7 a 77): em escala linear, tudo viraria um borrão no canto.
 * As referências do Sistema Solar existem porque "raio 11" não diz nada
 * sozinho — ao lado de Júpiter, diz.
 */
@Component({
  selector: 'app-exo-mass-radius',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe],
  templateUrl: './exo-mass-radius.html',
  styleUrl: '../../../shared/charts/charts.scss',
})
export class ExoMassRadiusComponent {
  protected readonly translate = inject(TranslateService);

  readonly data = input<Exoplanet[]>([]);

  protected readonly viewW = W;
  protected readonly viewH = H;
  protected readonly plotBottom = H - PAD.bottom;
  protected readonly plotLeft = PAD.left;
  protected readonly plotRight = W - PAD.right;
  protected readonly dotR = DOT_R;
  protected readonly refR = REF_R;

  protected readonly hovered = signal<Dot | null>(null);

  /** Faixa de massa (log10), com as referências incluídas. */
  private readonly xRange = computed<[number, number]>(() => {
    const massas = [
      ...this.data().map((p) => p.pl_bmasse ?? 0),
      ...SOLAR_REFERENCES.map((r) => r.mass),
    ].filter((m) => m > 0);
    if (!massas.length) {
      return [-1, 4];
    }
    return [
      Math.floor(Math.log10(Math.min(...massas))),
      Math.ceil(Math.log10(Math.max(...massas))),
    ];
  });

  /** Faixa de raio (log10). */
  private readonly yRange = computed<[number, number]>(() => {
    const raios = [
      ...this.data().map((p) => p.pl_rade ?? 0),
      ...SOLAR_REFERENCES.map((r) => r.radius),
    ].filter((r) => r > 0);
    if (!raios.length) {
      return [-1, 2];
    }
    return [
      Math.floor(Math.log10(Math.min(...raios))),
      Math.ceil(Math.log10(Math.max(...raios))),
    ];
  });

  protected readonly xTicks = computed(() => {
    const [lo, hi] = this.xRange();
    const ticks: { label: string; x: number }[] = [];
    for (let e = lo; e <= hi; e++) {
      ticks.push({ label: this.fmtPow(e), x: this.xOf(Math.pow(10, e)) });
    }
    return ticks;
  });

  protected readonly yTicks = computed(() => {
    const [lo, hi] = this.yRange();
    const ticks: { label: string; y: number }[] = [];
    for (let e = lo; e <= hi; e++) {
      ticks.push({ label: this.fmtPow(e), y: this.yOf(Math.pow(10, e)) });
    }
    return ticks;
  });

  protected readonly dots = computed<Dot[]>(() =>
    this.data()
      .filter((p) => (p.pl_bmasse ?? 0) > 0 && (p.pl_rade ?? 0) > 0)
      .map((planet) => ({
        planet,
        cx: this.xOf(planet.pl_bmasse!),
        cy: this.yOf(planet.pl_rade!),
      })),
  );

  protected readonly refs = computed<RefDot[]>(() =>
    SOLAR_REFERENCES.map((r) => ({
      name: r.name,
      cx: this.xOf(r.mass),
      cy: this.yOf(r.radius),
    })),
  );

  protected readonly tipLeft = computed(() => {
    const d = this.hovered();
    return d ? (d.cx / W) * 100 : 0;
  });
  protected readonly tipTop = computed(() => {
    const d = this.hovered();
    return d ? (d.cy / H) * 100 : 0;
  });

  protected hover(dot: Dot | null): void {
    this.hovered.set(dot);
  }

  /**
   * Ponto mais próximo do cursor: são ~900 pontos sobrepostos; mirar um de 8px
   * seria impossível (mesma solução da dispersão dos asteroides).
   */
  protected onPointerMove(event: MouseEvent): void {
    const svg = (event.currentTarget as SVGRectElement).ownerSVGElement;
    if (!svg) {
      return;
    }
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * W;
    const y = ((event.clientY - box.top) / box.height) * H;
    let best: Dot | null = null;
    let bestDist = Infinity;
    for (const dot of this.dots()) {
      const d = (dot.cx - x) ** 2 + (dot.cy - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = dot;
      }
    }
    this.hovered.set(best);
  }

  private xOf(massa: number): number {
    const [lo, hi] = this.xRange();
    const plotW = W - PAD.left - PAD.right;
    return PAD.left + ((Math.log10(massa) - lo) / (hi - lo)) * plotW;
  }

  private yOf(raio: number): number {
    const [lo, hi] = this.yRange();
    const plotH = H - PAD.top - PAD.bottom;
    return this.plotBottom - ((Math.log10(raio) - lo) / (hi - lo)) * plotH;
  }

  /**
   * 10^-1 → "0,1"; 10^3 → "1.000" (mais legível que notação científica).
   * Sempre pelo locale: `String(0.1)` sairia "0.1" com ponto ao lado de um
   * "1.000" com separador pt-BR, misturando duas convenções no mesmo eixo.
   */
  private fmtPow(exp: number): string {
    return Math.pow(10, exp).toLocaleString(this.translate.lang(), {
      maximumFractionDigits: 2,
    });
  }
}
