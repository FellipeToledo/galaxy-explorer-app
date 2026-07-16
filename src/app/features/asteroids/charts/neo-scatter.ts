import { Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Neo } from '../../../core/models/neo.model';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';

const W = 700;
const H = 300;
const PAD = { top: 18, right: 18, bottom: 40, left: 52 };
/** Raio do ponto (≥ 8px de marca) e do alvo de hover (bem maior que a marca). */
const DOT_R = 4.5;

interface Dot {
  neo: Neo;
  cx: number;
  cy: number;
  /** Rótulo direto só no extremo (o mais próximo da Terra). */
  label: string | null;
}

/**
 * Dispersão: distância da aproximação (× distância lunar) no eixo X e diâmetro
 * estimado no eixo Y (escala log — os tamanhos variam por ordens de grandeza).
 * Cor + rótulo na legenda separam perigosos dos demais; tooltip no hover/foco.
 */
@Component({
  selector: 'app-neo-scatter',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe],
  templateUrl: './neo-scatter.html',
  styleUrl: './charts.scss',
})
export class NeoScatterComponent {
  protected readonly translate = inject(TranslateService);

  readonly data = input<Neo[]>([]);

  protected readonly viewW = W;
  protected readonly viewH = H;
  protected readonly plotBottom = H - PAD.bottom;
  protected readonly plotLeft = PAD.left;
  protected readonly plotRight = W - PAD.right;
  protected readonly dotR = DOT_R;

  protected readonly hovered = signal<Dot | null>(null);

  /** Máximo do eixo X (distâncias lunares), arredondado para cima. */
  private readonly xMax = computed(() => {
    const max = Math.max(1, ...this.data().map((n) => n.missLunar));
    return Math.ceil(max);
  });

  /** Faixa do eixo Y em log10(metros), com uma década de folga arredondada. */
  private readonly yRange = computed<[number, number]>(() => {
    const sizes = this.data().map((n) => Math.max(1, n.diameterAvg));
    if (!sizes.length) {
      return [0, 3];
    }
    const lo = Math.floor(Math.log10(Math.min(...sizes)));
    const hi = Math.ceil(Math.log10(Math.max(...sizes)));
    return [lo, Math.max(hi, lo + 1)];
  });

  protected readonly xTicks = computed(() => {
    const max = this.xMax();
    const step = Math.max(1, Math.round(max / 5));
    const ticks: { label: string; x: number }[] = [];
    for (let v = 0; v <= max; v += step) {
      ticks.push({ label: String(v), x: this.xOf(v) });
    }
    return ticks;
  });

  /** Marcas do eixo log: uma por década (1 m, 10 m, 100 m, 1 km…). */
  protected readonly yTicks = computed(() => {
    const [lo, hi] = this.yRange();
    const ticks: { label: string; y: number }[] = [];
    for (let e = lo; e <= hi; e++) {
      const meters = Math.pow(10, e);
      ticks.push({
        label: meters >= 1000 ? `${meters / 1000} km` : `${meters} m`,
        y: this.yOfLog(e),
      });
    }
    return ticks;
  });

  protected readonly dots = computed<Dot[]>(() => {
    const list = this.data();
    if (!list.length) {
      return [];
    }
    // O extremo rotulado é o de aproximação mais próxima.
    const closest = list.reduce((a, b) => (a.missKm <= b.missKm ? a : b));
    return list.map((neo) => ({
      neo,
      cx: this.xOf(neo.missLunar),
      cy: this.yOfLog(Math.log10(Math.max(1, neo.diameterAvg))),
      // uid, não id: o mesmo asteroide pode ter duas aproximações no período
      // e o rótulo cairia no ponto errado.
      label: neo.uid === closest.uid ? neo.name : null,
    }));
  });

  protected readonly tipLeft = computed(() => {
    const dot = this.hovered();
    return dot ? (dot.cx / W) * 100 : 0;
  });
  protected readonly tipTop = computed(() => {
    const dot = this.hovered();
    return dot ? (dot.cy / H) * 100 : 0;
  });

  protected hover(dot: Dot | null): void {
    this.hovered.set(dot);
  }

  /**
   * Ponto mais próximo do cursor: com dezenas de pontos sobrepostos (e o SVG
   * encolhendo no mobile), mirar um círculo de 9px seria impossível — o plot
   * inteiro vira o alvo e o ponto mais perto do cursor ganha o tooltip.
   */
  protected onPointerMove(event: MouseEvent): void {
    const svg = (event.currentTarget as SVGRectElement).ownerSVGElement;
    if (!svg) {
      return;
    }
    // Converte a posição do cursor para as unidades do viewBox.
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

  private xOf(lunar: number): number {
    const plotW = W - PAD.left - PAD.right;
    return PAD.left + (lunar / this.xMax()) * plotW;
  }

  private yOfLog(exp: number): number {
    const [lo, hi] = this.yRange();
    const plotH = H - PAD.top - PAD.bottom;
    return this.plotBottom - ((exp - lo) / (hi - lo)) * plotH;
  }
}
