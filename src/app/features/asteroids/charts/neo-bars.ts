import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NeoDayCount } from '../../../core/models/neo.model';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';

/** Geometria do gráfico (unidades do viewBox). */
const W = 700;
const H = 260;
const PAD = { top: 18, right: 14, bottom: 34, left: 44 };
/** Espessura máxima da coluna — a sobra da faixa vira respiro. */
const MAX_BAR = 24;
/** Espaço mínimo por rótulo de data no eixo X ("dd/MM" ≈ 30px). */
const TICK_MIN_PX = 34;
/** Vão na cor da superfície entre os segmentos empilhados. */
const GAP = 2;
const RADIUS = 4;

interface Segment {
  path: string;
  hazardous: boolean;
}
interface Column {
  date: string;
  data: NeoDayCount;
  segments: Segment[];
  /** Faixa inteira: alvo de hover generoso (não só a coluna). */
  hitX: number;
  hitW: number;
  centerX: number;
  topY: number;
  labelValue: string | null;
  /** Rótulo de data no eixo: com 30 dias, só alguns cabem sem colidir. */
  showTick: boolean;
}

/**
 * Colunas empilhadas: asteroides por dia, separados entre perigosos e demais.
 * SVG próprio (sem lib), com legenda, tooltip no hover/foco e rótulo direto
 * apenas no dia de pico — os demais valores ficam no eixo, no tooltip e na
 * tabela da página.
 */
@Component({
  selector: 'app-neo-bars',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './neo-bars.html',
  styleUrl: '../../../shared/charts/charts.scss',
})
export class NeoBarsComponent {
  protected readonly translate = inject(TranslateService);

  readonly data = input<NeoDayCount[]>([]);

  protected readonly viewW = W;
  protected readonly viewH = H;
  protected readonly plotBottom = H - PAD.bottom;

  protected readonly hovered = signal<Column | null>(null);

  /** Escala do eixo Y: topo arredondado para um número "limpo". */
  private readonly yMax = computed(() => {
    const max = Math.max(1, ...this.data().map((d) => d.total));
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
    const days = this.data();
    if (!days.length) {
      return [];
    }
    const plotW = W - PAD.left - PAD.right;
    const band = plotW / days.length;
    const barW = Math.min(MAX_BAR, band * 0.55);
    const peak = Math.max(...days.map((d) => d.total));
    // "dd/MM" ocupa ~30px: com 30 dias a faixa cai para ~21px e os rótulos
    // colidiriam. Mostra 1 a cada N.
    const tickStride = Math.max(1, Math.ceil(TICK_MIN_PX / band));
    const lastIdx = days.length - 1;
    // O rótulo direto marca o dia de pico — só vale se o pico for único;
    // num empate ele viraria "um número em cada coluna" (o eixo já basta).
    const peakIsUnique = days.filter((d) => d.total === peak).length === 1;

    return days.map((d, i) => {
      const hitX = PAD.left + band * i;
      const centerX = hitX + band / 2;
      const x = centerX - barW / 2;
      const base = this.plotBottom;
      const safeTop = this.yOf(d.safe);
      const totalTop = this.yOf(d.total);
      const segments: Segment[] = [];

      if (d.safe > 0) {
        // Segmento de baixo: quadrado na linha de base; topo arredondado só
        // quando é o fim da coluna (sem perigosos empilhados acima).
        segments.push({
          hazardous: false,
          path: this.barPath(x, safeTop, barW, base - safeTop, d.hazardous === 0),
        });
      }
      if (d.hazardous > 0) {
        // Vão de 2px na cor da superfície separando os dois segmentos.
        const top = totalTop;
        const bottom = d.safe > 0 ? safeTop - GAP : base;
        segments.push({
          hazardous: true,
          path: this.barPath(x, top, barW, Math.max(0, bottom - top), true),
        });
      }

      return {
        date: d.date,
        data: d,
        segments,
        hitX,
        hitW: band,
        centerX,
        topY: totalTop,
        labelValue: peakIsUnique && d.total === peak && peak > 0 ? String(d.total) : null,
        // O último dia sempre tem rótulo (fecha o eixo); os regulares só se
        // ficarem longe dele — senão o penúltimo cola no último (medido: -6px).
        showTick:
          i === lastIdx ||
          (i % tickStride === 0 && lastIdx - i >= tickStride),
      };
    });
  });

  /** Posição do tooltip em % do viewBox (o SVG escala preservando a razão). */
  protected readonly tipLeft = computed(() => {
    const col = this.hovered();
    return col ? (col.centerX / W) * 100 : 0;
  });
  protected readonly tipTop = computed(() => {
    const col = this.hovered();
    return col ? (col.topY / H) * 100 : 0;
  });

  protected hover(col: Column | null): void {
    this.hovered.set(col);
  }

  private yOf(value: number): number {
    const plotH = H - PAD.top - PAD.bottom;
    return this.plotBottom - (value / this.yMax()) * plotH;
  }

  /** Passo de tick "limpo" (1/2/5 × potência de 10) para no máx. ~5 marcas. */
  private tickStep(max: number): number {
    const raw = Math.max(1, max) / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * mag;
  }

  /** Retângulo com o topo arredondado (4px) e a base quadrada. */
  private barPath(x: number, y: number, w: number, h: number, roundTop: boolean): string {
    const r = roundTop ? Math.min(RADIUS, h, w / 2) : 0;
    const bottom = y + h;
    return `M${x},${bottom} L${x},${y + r} Q${x},${y} ${x + r},${y}` +
      ` L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${bottom} Z`;
  }
}
