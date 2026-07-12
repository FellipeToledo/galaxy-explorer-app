import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinkle: number;
  speed: number;
}

/**
 * Fundo animado com campo de estrelas em <canvas>.
 * Fica atrás de todo o conteúdo (position: fixed) e respeita
 * `prefers-reduced-motion` desenhando um quadro estático.
 */
@Component({
  selector: 'app-starfield',
  standalone: true,
  template: `<canvas #canvas class="starfield" aria-hidden="true"></canvas>`,
  styles: [
    `
      .starfield {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
        display: block;
        pointer-events: none;
      }
    `,
  ],
})
export class StarfieldComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly zone = inject(NgZone);
  private ctx!: CanvasRenderingContext2D;
  private stars: Star[] = [];
  private frameId = 0;
  private width = 0;
  private height = 0;
  private readonly onResize = () => this.setup();

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.setup();
    window.addEventListener('resize', this.onResize);

    const reduced = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (reduced) {
      this.draw(0);
      return;
    }

    // Roda o loop fora do Angular para não disparar detecção de mudanças.
    this.zone.runOutsideAngular(() => {
      const loop = (t: number) => {
        this.draw(t);
        this.frameId = requestAnimationFrame(loop);
      };
      this.frameId = requestAnimationFrame(loop);
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onResize);
  }

  private setup(): void {
    const canvas = this.canvasRef.nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    canvas.width = this.width * dpr;
    canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Densidade proporcional à área, com limite para performance.
    const count = Math.min(
      260,
      Math.round((this.width * this.height) / 6500),
    );
    this.stars = Array.from({ length: count }, () => this.makeStar());
  }

  private makeStar(): Star {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      r: Math.random() * 1.4 + 0.3,
      baseAlpha: Math.random() * 0.5 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.4 + 0.1,
    };
  }

  private draw(t: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    for (const s of this.stars) {
      // Cintilação suave via seno + leve deriva vertical.
      const alpha =
        s.baseAlpha + Math.sin(t * 0.001 + s.twinkle) * 0.25;
      s.y += s.speed * 0.15;
      if (s.y > this.height) {
        s.y = 0;
        s.x = Math.random() * this.width;
      }

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220, 225, 255, ${Math.max(0, alpha)})`;
      ctx.shadowBlur = s.r > 1 ? 6 : 0;
      ctx.shadowColor = 'rgba(139, 92, 246, 0.7)';
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}
