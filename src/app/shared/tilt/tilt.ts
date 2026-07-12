import {
  Directive,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
  input,
} from '@angular/core';

/**
 * Efeito de inclinação 3D que segue o mouse, para cards "futuristas".
 * Atualiza custom properties (--rx, --ry, --mx, --my) sem tocar em bindings
 * do Angular, e roda fora da zona para não custar detecção de mudança.
 * Respeita `prefers-reduced-motion`.
 */
@Directive({
  selector: '[appTilt]',
  standalone: true,
})
export class TiltDirective implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  /** Ângulo máximo de inclinação em graus. */
  readonly tiltMax = input(9);

  private el!: HTMLElement;
  private enabled = true;

  private readonly onMove = (e: MouseEvent): void => {
    const rect = this.el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1
    const max = this.tiltMax();
    const ry = (px - 0.5) * 2 * max;
    const rx = -(py - 0.5) * 2 * max;
    this.el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    this.el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    this.el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    this.el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
  };

  private readonly onLeave = (): void => {
    this.el.style.setProperty('--rx', '0deg');
    this.el.style.setProperty('--ry', '0deg');
    this.el.style.setProperty('--mx', '50%');
    this.el.style.setProperty('--my', '50%');
  };

  ngOnInit(): void {
    this.el = this.host.nativeElement;
    this.enabled = !window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (!this.enabled) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.el.addEventListener('mousemove', this.onMove);
      this.el.addEventListener('mouseleave', this.onLeave);
    });
  }

  ngOnDestroy(): void {
    this.el.removeEventListener('mousemove', this.onMove);
    this.el.removeEventListener('mouseleave', this.onLeave);
  }
}
