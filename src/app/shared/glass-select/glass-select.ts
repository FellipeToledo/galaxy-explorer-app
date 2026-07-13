import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export interface SelectOption {
  label: string;
  value: string;
}

/**
 * Dropdown "glass" custom — substitui o <select> nativo por um painel
 * translúcido no tema galáxia, com animação, opção ativa destacada,
 * navegação por teclado (setas/Enter/Esc) e fechamento ao clicar fora.
 */
@Component({
  selector: 'app-glass-select',
  standalone: true,
  templateUrl: './glass-select.html',
  styleUrl: './glass-select.scss',
})
export class GlassSelectComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input<SelectOption[]>([]);
  readonly value = input<string>('');
  readonly minWidth = input<string>('150px');
  readonly ariaLabel = input<string>('');

  readonly valueChange = output<string>();

  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);

  protected readonly selectedLabel = computed(() => {
    const opt = this.options().find((o) => o.value === this.value());
    return opt?.label ?? '';
  });

  protected toggle(): void {
    this.open() ? this.close() : this.openPanel();
  }

  private openPanel(): void {
    this.open.set(true);
    const idx = this.options().findIndex((o) => o.value === this.value());
    this.activeIndex.set(idx >= 0 ? idx : 0);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected select(value: string): void {
    this.valueChange.emit(value);
    this.close();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    const opts = this.options();
    if (!this.open()) {
      if (['ArrowDown', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        this.openPanel();
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.set((this.activeIndex() + 1) % opts.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(
          (this.activeIndex() - 1 + opts.length) % opts.length,
        );
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        {
          const opt = opts[this.activeIndex()];
          if (opt) {
            this.select(opt.value);
          }
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
    }
  }
}
