import {
  Directive,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';

/**
 * Alterna a classe `in-view` conforme o elemento entra/sai da viewport,
 * permitindo animar (ex.: girar a borda neon) apenas os cards visíveis.
 * Roda fora da zona do Angular e é desativada em prefers-reduced-motion.
 */
@Directive({
  selector: '[appInView]',
  standalone: true,
})
export class InViewDirective implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const reduced = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            entry.target.classList.toggle('in-view', entry.isIntersecting);
          }
        },
        { rootMargin: '120px' },
      );
      this.observer.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
