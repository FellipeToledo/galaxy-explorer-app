import {
  Directive,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
  output,
} from '@angular/core';

/**
 * Emite `scrolled` quando o elemento (sentinela no fim da lista) entra na
 * viewport — base do scroll infinito. Observa com uma margem para pré-carregar
 * antes de o usuário chegar ao fim. Roda fora da zona do Angular.
 */
@Directive({
  selector: '[appScrollEnd]',
  standalone: true,
})
export class ScrollEndDirective implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  readonly scrolled = output<void>();

  private observer?: IntersectionObserver;

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this.zone.run(() => this.scrolled.emit());
          }
        },
        { rootMargin: '400px' },
      );
      this.observer.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
