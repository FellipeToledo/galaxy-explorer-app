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
  TECH_COLLECTIONS,
  TECH_SUGGESTIONS,
  TechCollection,
  TechItem,
  techUrl,
} from '../../core/models/tech.model';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { ContentTranslatePipe } from '../../core/i18n/content-translate.pipe';
import { InViewDirective } from '../../shared/in-view/in-view';

/**
 * 🔬 Tecnologia — o que a NASA licencia: patentes, software e spinoffs.
 *
 * As três coleções vivem na mesma API e diferem no que trazem (medido):
 *  - **patent**: 175/175 com imagem e página pública → card COM foto, é link;
 *  - **software**: 0 imagem, mas 100% com licença e 66% com link de repositório
 *    → card compacto, o botão "ver no GitHub" quando há link;
 *  - **spinoff**: só texto, e a página pública **não existe** (dá 404) → card
 *    informativo, não-clicável.
 *
 * A API **exige** termo (sem ele o corpo volta vazio), por isso a seção abre
 * com uma busca pronta.
 */
@Component({
  selector: 'app-tech',
  standalone: true,
  imports: [NgTemplateOutlet, TranslatePipe, ContentTranslatePipe, InViewDirective],
  templateUrl: './tech.html',
  styleUrl: './tech.scss',
})
export class TechComponent implements OnInit {
  private readonly api = inject(NasaApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly translate = inject(TranslateService);

  protected readonly collections = TECH_COLLECTIONS;
  protected readonly collection = signal<TechCollection>('patent');

  protected readonly items = signal<TechItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly term = signal('robot');

  protected readonly suggestions = TECH_SUGGESTIONS;
  protected readonly searchQuery = signal('robot');
  protected readonly showSuggestions = signal(false);
  protected readonly suggestionIndex = signal(-1);
  private readonly typed = new Subject<string>();

  protected readonly filteredSuggestions = computed<string[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = q
      ? TECH_SUGGESTIONS.filter((s) => s.includes(q) && s !== q)
      : TECH_SUGGESTIONS;
    return list.slice(0, 8);
  });

  /** Só patentes têm imagem: define se o card mostra a área de foto. */
  protected readonly hasImages = computed(() => this.collection() === 'patent');

  /** Centros distintos no resultado — dá a dimensão de "quem inventou". */
  protected readonly centers = computed(
    () => new Set(this.items().map((p) => p.center).filter(Boolean)).size,
  );

  protected readonly url = techUrl;

  ngOnInit(): void {
    this.typed
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((t) => this.search(t));
    this.search(this.term());
  }

  protected selectCollection(c: TechCollection): void {
    if (this.collection() === c) {
      return;
    }
    this.collection.set(c);
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
    const collection = this.collection();
    this.api.searchTech(collection, term).subscribe({
      next: (rows) => {
        // Descarta se o usuário trocou de coleção/termo antes de chegar.
        if (this.collection() === collection && this.term() === term) {
          this.items.set(rows);
          this.loading.set(false);
        }
      },
      error: () => {
        this.error.set('tech.error');
        this.loading.set(false);
      },
    });
  }
}
