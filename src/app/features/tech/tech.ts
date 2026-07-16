import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NasaApiService } from '../../core/services/nasa-api.service';
import {
  Patent,
  TECH_SUGGESTIONS,
  patentUrl,
} from '../../core/models/tech.model';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { ContentTranslatePipe } from '../../core/i18n/content-translate.pipe';
import { InViewDirective } from '../../shared/in-view/in-view';

/**
 * 🔬 Tecnologia — patentes da NASA disponíveis para licenciamento.
 *
 * Só patentes: `software` e `spinoff` existem na mesma API, mas **nenhum** dos
 * seus itens tem imagem (medido: 0/84 e 0/284, contra 175/175 das patentes) —
 * seriam cards cegos num app visual.
 *
 * A API **exige** termo (sem ele o corpo volta vazio), por isso a seção abre
 * com uma busca pronta em vez de um estado vazio.
 */
@Component({
  selector: 'app-tech',
  standalone: true,
  imports: [TranslatePipe, ContentTranslatePipe, InViewDirective],
  templateUrl: './tech.html',
  styleUrl: './tech.scss',
})
export class TechComponent implements OnInit {
  private readonly api = inject(NasaApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly translate = inject(TranslateService);

  protected readonly patents = signal<Patent[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly term = signal('robot');

  protected readonly suggestions = TECH_SUGGESTIONS;
  protected readonly searchQuery = signal('robot');
  protected readonly showSuggestions = signal(false);
  protected readonly suggestionIndex = signal(-1);
  private readonly typed = new Subject<string>();

  /** Sugestões curadas (a API não tem autocomplete). */
  protected readonly filteredSuggestions = computed<string[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = q
      ? TECH_SUGGESTIONS.filter((s) => s.includes(q) && s !== q)
      : TECH_SUGGESTIONS;
    return list.slice(0, 8);
  });

  /** Centros distintos no resultado — dá a dimensão de "quem inventou". */
  protected readonly centers = computed(
    () => new Set(this.patents().map((p) => p.center).filter(Boolean)).size,
  );

  protected readonly link = patentUrl;

  ngOnInit(): void {
    // Digitar troca a busca sozinho (a API é rápida e o resultado é pequeno).
    this.typed
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((t) => this.search(t));
    this.search(this.term());
  }

  protected onInput(value: string): void {
    this.searchQuery.set(value);
    this.showSuggestions.set(true);
    this.suggestionIndex.set(-1);
    const t = value.trim();
    if (t) {
      this.typed.next(t);
    }
  }

  protected submit(): void {
    this.showSuggestions.set(false);
    const t = this.searchQuery().trim();
    if (t) {
      this.search(t);
    }
  }

  protected selectSuggestion(s: string): void {
    this.searchQuery.set(s);
    this.showSuggestions.set(false);
    this.suggestionIndex.set(-1);
    this.search(s);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const list = this.filteredSuggestions();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.showSuggestions.set(true);
        if (list.length) {
          this.suggestionIndex.set((this.suggestionIndex() + 1) % list.length);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (list.length) {
          this.suggestionIndex.set(
            (this.suggestionIndex() - 1 + list.length) % list.length,
          );
        }
        break;
      case 'Enter': {
        const i = this.suggestionIndex();
        if (this.showSuggestions() && i >= 0 && i < list.length) {
          event.preventDefault();
          this.selectSuggestion(list[i]);
        }
        break;
      }
      case 'Escape':
        this.showSuggestions.set(false);
        this.suggestionIndex.set(-1);
        break;
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.showSuggestions()) {
      return;
    }
    const wrap = this.host.nativeElement.querySelector('.search-wrap');
    if (wrap && !wrap.contains(event.target as Node)) {
      this.showSuggestions.set(false);
    }
  }

  protected retry(): void {
    this.search(this.term());
  }

  /** Algumas imagens dão 403 isolado: esconde a quebrada em vez de exibi-la. */
  protected onImageError(event: Event): void {
    (event.target as HTMLImageElement).closest('.card-img')?.classList.add('no-img');
  }

  private search(term: string): void {
    this.term.set(term);
    this.loading.set(true);
    this.error.set(null);
    this.api.searchPatents(term).subscribe({
      next: (rows) => {
        this.patents.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('tech.error');
        this.loading.set(false);
      },
    });
  }
}
