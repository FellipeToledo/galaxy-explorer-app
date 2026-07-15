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
import { Subject, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  tap,
} from 'rxjs/operators';
import { NasaApiService } from '../../core/services/nasa-api.service';
import {
  MediaType,
  NasaMedia,
  SORT_OPTIONS,
  SortMode,
} from '../../core/models/media.model';
import { ScrollEndDirective } from '../../shared/scroll-end/scroll-end';
import { MediaCardComponent } from '../../shared/media-card/media-card';
import { MediaLightboxComponent } from '../../shared/media-lightbox/media-lightbox';
import {
  GlassSelectComponent,
  SelectOption,
} from '../../shared/glass-select/glass-select';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';

/** Tamanho de página da NASA Image and Video Library. */
const PAGE_SIZE = 100;
/** Primeiro ano do acervo (Explorer 1, 1958). */
const FIRST_YEAR = 1958;
const SUGGEST_DEBOUNCE_MS = 320;
const SUGGEST_MIN_CHARS = 3;

/** Filtro de tipo: '' = tudo (a API aceita a lista separada por vírgula). */
type TypeFilter = '' | MediaType;

/** Termos de partida — o acervo inteiro é grande demais para chutar. */
const SUGGESTIONS: string[] = [
  'Apollo 11',
  'Hubble deep field',
  'Saturn rings',
  'Nebula',
  'International Space Station',
  'Earthrise',
  'Solar eclipse',
  'Jupiter',
  'Artemis launch',
  'Milky Way',
  'Black hole',
  'Voyager',
  'Space shuttle launch',
  'Spacewalk',
  'James Webb',
];

/**
 * 🎨 Busca de mídia — busca livre no acervo inteiro da NASA (imagens e vídeos).
 *
 * Difere do Marte: lá a busca é contextual (rovers marcianos); aqui é o acervo
 * todo. Cards, lightbox, autocomplete e scroll infinito são compartilhados.
 */
@Component({
  selector: 'app-media',
  standalone: true,
  imports: [
    ScrollEndDirective,
    MediaCardComponent,
    MediaLightboxComponent,
    GlassSelectComponent,
    TranslatePipe,
  ],
  templateUrl: './media.html',
  styleUrl: './media.scss',
})
export class MediaComponent implements OnInit {
  private readonly api = inject(NasaApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly translate = inject(TranslateService);

  protected readonly items = signal<NasaMedia[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Antes da 1ª busca mostramos o convite, não um "nada encontrado". */
  protected readonly searched = signal(false);

  private currentTerm = '';
  private page = 1;

  protected readonly type = signal<TypeFilter>('');
  protected readonly year = signal<string>('');
  protected readonly sort = signal<SortMode>('relevance');

  private readonly years = ((): string[] => {
    const now = new Date().getFullYear();
    const list: string[] = [];
    for (let y = now; y >= FIRST_YEAR; y--) {
      list.push(String(y));
    }
    return list;
  })();

  protected readonly typeOptions = computed<SelectOption[]>(() => [
    { label: this.translate.t('media.typeAll'), value: '' },
    { label: this.translate.t('media.typeImage'), value: 'image' },
    { label: this.translate.t('media.typeVideo'), value: 'video' },
  ]);

  protected readonly yearOptions = computed<SelectOption[]>(() => [
    { label: this.translate.t('media.allYears'), value: '' },
    ...this.years.map((y) => ({ label: y, value: y })),
  ]);

  protected readonly sortOptions = computed<SelectOption[]>(() =>
    SORT_OPTIONS.map((s) => ({
      label: this.translate.t('sort.' + s.id),
      value: s.id,
    })),
  );

  // ── Autocomplete ──
  protected readonly searchQuery = signal('');
  protected readonly showSuggestions = signal(false);
  protected readonly suggestionIndex = signal(-1);
  protected readonly suggestLoading = signal(false);
  private readonly apiSuggestions = signal<string[]>([]);
  private readonly suggestTerm = new Subject<string>();

  protected readonly filteredSuggestions = computed<string[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const fromApi = this.apiSuggestions();
    if (q.length >= SUGGEST_MIN_CHARS && fromApi.length) {
      return fromApi;
    }
    const list = q
      ? SUGGESTIONS.filter(
          (s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q,
        )
      : SUGGESTIONS;
    return list.slice(0, 8);
  });

  /** Ordenação client-side (a API só entrega por relevância). */
  protected readonly sortedItems = computed<NasaMedia[]>(() => {
    const list = this.items();
    const mode = this.sort();
    if (mode === 'relevance') {
      return list;
    }
    const dir = mode === 'newest' ? -1 : 1;
    return [...list].sort((a, b) => {
      const ta = a.dateCreated ? Date.parse(a.dateCreated) : NaN;
      const tb = b.dateCreated ? Date.parse(b.dateCreated) : NaN;
      if (isNaN(ta) && isNaN(tb)) return 0;
      if (isNaN(ta)) return 1;
      if (isNaN(tb)) return -1;
      return (ta - tb) * dir;
    });
  });

  protected readonly lightbox = signal<NasaMedia | null>(null);

  ngOnInit(): void {
    this.suggestTerm
      .pipe(
        debounceTime(SUGGEST_DEBOUNCE_MS),
        distinctUntilChanged(),
        tap((term) => this.suggestLoading.set(term.length >= SUGGEST_MIN_CHARS)),
        switchMap((term) =>
          term.length < SUGGEST_MIN_CHARS
            ? of<string[]>([])
            : this.api.suggest(term).pipe(catchError(() => of<string[]>([]))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => {
        this.apiSuggestions.set(list);
        this.suggestLoading.set(false);
      });
  }

  protected onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.showSuggestions.set(true);
    this.suggestionIndex.set(-1);
    this.suggestTerm.next(value.trim());
  }

  protected submitSearch(): void {
    const term = this.searchQuery().trim();
    if (!term) {
      return;
    }
    this.showSuggestions.set(false);
    this.search(term);
  }

  protected selectSuggestion(term: string): void {
    this.searchQuery.set(term);
    this.showSuggestions.set(false);
    this.suggestionIndex.set(-1);
    this.search(term);
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
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
        const idx = this.suggestionIndex();
        if (this.showSuggestions() && idx >= 0 && idx < list.length) {
          event.preventDefault();
          this.selectSuggestion(list[idx]);
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

  /** Tipo e ano são filtros da API → refazem a busca; ordenação não. */
  protected onTypeChange(value: string): void {
    this.type.set(value as TypeFilter);
    this.rerunSearch();
  }

  protected onYearChange(value: string): void {
    this.year.set(value);
    this.rerunSearch();
  }

  protected onSortChange(value: string): void {
    this.sort.set(value as SortMode);
  }

  protected retry(): void {
    this.rerunSearch();
  }

  private rerunSearch(): void {
    if (this.currentTerm) {
      this.search(this.currentTerm);
    }
  }

  private search(term: string): void {
    this.currentTerm = term;
    this.page = 1;
    this.loading.set(true);
    this.searched.set(true);
    this.hasMore.set(false);
    this.error.set(null);

    this.api
      .searchImages(term, 1, ...this.yearRange(), this.mediaTypeParam())
      .subscribe({
        next: (list) => {
          this.items.set(list);
          this.hasMore.set(list.length >= PAGE_SIZE);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('media.error');
          this.loading.set(false);
        },
      });
  }

  protected loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore() || this.error()) {
      return;
    }
    this.loadingMore.set(true);
    const nextPage = this.page + 1;

    this.api
      .searchImages(
        this.currentTerm,
        nextPage,
        ...this.yearRange(),
        this.mediaTypeParam(),
      )
      .subscribe({
        next: (list) => {
          if (list.length === 0) {
            this.hasMore.set(false);
          } else {
            this.page = nextPage;
            // Evita chaves duplicadas no @for (trackBy nasaId).
            this.items.update((cur) => {
              const seen = new Set(cur.map((i) => i.nasaId));
              return [...cur, ...list.filter((i) => !seen.has(i.nasaId))];
            });
            this.hasMore.set(list.length >= PAGE_SIZE);
          }
          this.loadingMore.set(false);
        },
        // Mantém hasMore para permitir nova tentativa pelo botão/scroll.
        error: () => this.loadingMore.set(false),
      });
  }

  /** '' (tudo) vira a lista que a API entende. */
  private mediaTypeParam(): MediaType | 'image,video' {
    return this.type() || 'image,video';
  }

  private yearRange(): [string?, string?] {
    const y = this.year();
    return y ? [y, y] : [undefined, undefined];
  }

  protected openLightbox(item: NasaMedia): void {
    this.lightbox.set(item);
  }

  protected closeLightbox(): void {
    this.lightbox.set(null);
  }
}
