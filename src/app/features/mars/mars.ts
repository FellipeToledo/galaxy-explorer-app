import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { NasaApiService } from '../../core/services/nasa-api.service';
import {
  NasaImage,
  ROVERS,
  RoverName,
  SORT_OPTIONS,
  SortMode,
} from '../../core/models/mars.model';
import { InViewDirective } from '../../shared/in-view/in-view';
import { ScrollEndDirective } from '../../shared/scroll-end/scroll-end';
import {
  GlassSelectComponent,
  SelectOption,
} from '../../shared/glass-select/glass-select';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { ContentTranslatePipe } from '../../core/i18n/content-translate.pipe';

/** Tamanho de página padrão da NASA Image and Video Library. */
const PAGE_SIZE = 100;
/** Primeiro ano com imagens de rovers em Marte (Spirit/Opportunity, 2004). */
const FIRST_YEAR = 2004;

/** Sugestões de busca (termos comuns/relevantes de Marte) para o autocomplete. */
const SEARCH_SUGGESTIONS: string[] = [
  'Jezero Crater',
  'Gale Crater',
  'Mount Sharp',
  'Endeavour Crater',
  'Mars panorama',
  'Mars sunset',
  'Mars selfie',
  'self-portrait',
  'sample tube',
  'Ingenuity helicopter',
  'dust devil',
  'sand dunes',
  'rover tracks',
  'drill hole',
  'Martian landscape',
  'rock formation',
  'Perseverance landing',
  'Martian sky',
  'crater rim',
  'ancient delta',
];

@Component({
  selector: 'app-mars',
  standalone: true,
  imports: [
    DatePipe,
    InViewDirective,
    ScrollEndDirective,
    GlassSelectComponent,
    TranslatePipe,
    ContentTranslatePipe,
  ],
  templateUrl: './mars.html',
  styleUrl: './mars.scss',
})
export class MarsComponent implements OnInit {
  private readonly api = inject(NasaApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly translate = inject(TranslateService);

  protected readonly rovers = ROVERS;

  /** Anos disponíveis (atual → 2004). */
  private readonly years = ((): string[] => {
    const now = new Date().getFullYear();
    const list: string[] = [];
    for (let y = now; y >= FIRST_YEAR; y--) {
      list.push(String(y));
    }
    return list;
  })();

  /** Opções de ordenação (reativas ao idioma). */
  protected readonly sortOptions = computed<SelectOption[]>(() =>
    SORT_OPTIONS.map((s) => ({
      label: this.translate.t('sort.' + s.id),
      value: s.id,
    })),
  );

  /** Opções de ano (reativas ao idioma para o rótulo "Todos os anos"). */
  protected readonly yearOptions = computed<SelectOption[]>(() => [
    { label: this.translate.t('mars.allYears'), value: '' },
    ...this.years.map((y) => ({ label: y, value: y })),
  ]);

  protected readonly images = signal<NasaImage[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly error = signal<string | null>(null);

  private currentTerm = '';
  private page = 1;

  protected readonly rover = signal<RoverName | null>('perseverance');
  protected readonly query = signal<string>('');
  /** Ano selecionado ('' = todos). */
  protected readonly year = signal<string>('');
  /** Ordenação client-side (a API só entrega por relevância). */
  protected readonly sort = signal<SortMode>('relevance');

  // ── Autocomplete da busca ──
  protected readonly searchQuery = signal('');
  protected readonly showSuggestions = signal(false);
  protected readonly suggestionIndex = signal(-1);
  protected readonly filteredSuggestions = computed<string[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = q
      ? SEARCH_SUGGESTIONS.filter(
          (s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q,
        )
      : SEARCH_SUGGESTIONS;
    return list.slice(0, 8);
  });

  /** Imagens já ordenadas conforme o modo escolhido (sem novo request). */
  protected readonly sortedImages = computed<NasaImage[]>(() => {
    const imgs = this.images();
    const mode = this.sort();
    if (mode === 'relevance') {
      return imgs;
    }
    const dir = mode === 'newest' ? -1 : 1;
    // Ordena por data; itens sem data vão para o fim.
    return [...imgs].sort((a, b) => {
      const ta = a.dateCreated ? Date.parse(a.dateCreated) : NaN;
      const tb = b.dateCreated ? Date.parse(b.dateCreated) : NaN;
      if (isNaN(ta) && isNaN(tb)) return 0;
      if (isNaN(ta)) return 1;
      if (isNaN(tb)) return -1;
      return (ta - tb) * dir;
    });
  });

  /** Imagem ampliada no lightbox (ou null). */
  protected readonly lightbox = signal<NasaImage | null>(null);

  ngOnInit(): void {
    this.runRoverSearch();
  }

  protected selectRover(name: RoverName): void {
    this.rover.set(name);
    this.query.set('');
    this.runRoverSearch();
  }

  protected onYearChange(value: string): void {
    this.year.set(value);
    // Ano é um filtro real da API → refaz a busca atual (rover ou termo livre).
    this.rover() ? this.runRoverSearch() : this.search(this.query() || 'Mars');
  }

  protected onSortChange(value: string): void {
    this.sort.set(value as SortMode);
    // Ordenação é client-side: não refaz request.
  }

  protected onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.showSuggestions.set(true);
    this.suggestionIndex.set(-1);
  }

  /** Enter/botão de busca: dispara a busca com o termo digitado. */
  protected submitSearch(): void {
    const term = this.searchQuery().trim();
    if (!term) {
      return;
    }
    this.showSuggestions.set(false);
    this.rover.set(null);
    this.search(term);
  }

  protected selectSuggestion(term: string): void {
    this.searchQuery.set(term);
    this.showSuggestions.set(false);
    this.suggestionIndex.set(-1);
    this.rover.set(null);
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
        // senão, deixa o submit do form disparar submitSearch()
        break;
      }
      case 'Escape':
        this.showSuggestions.set(false);
        this.suggestionIndex.set(-1);
        break;
    }
  }

  /** Fecha as sugestões ao clicar fora do campo de busca. */
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
    this.rover() ? this.runRoverSearch() : this.search(this.query() || 'Mars');
  }

  /** Monta a busca a partir do rover atual e dispara. */
  private runRoverSearch(): void {
    const rover = this.rovers.find((r) => r.name === this.rover());
    const term = rover?.query ?? 'Mars';
    this.query.set(term);
    this.search(term);
  }

  private search(term: string): void {
    this.currentTerm = term;
    this.page = 1;
    this.loading.set(true);
    this.hasMore.set(false);
    this.error.set(null);

    const [ys, ye] = this.yearRange();
    this.api.searchImages(term, 1, ys, ye).subscribe({
      next: (imgs) => {
        this.images.set(imgs);
        this.hasMore.set(imgs.length >= PAGE_SIZE);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('mars.error');
        this.loading.set(false);
      },
    });
  }

  /** Carrega a próxima página e anexa aos resultados (scroll infinito). */
  protected loadMore(): void {
    if (
      this.loading() ||
      this.loadingMore() ||
      !this.hasMore() ||
      this.error()
    ) {
      return;
    }
    this.loadingMore.set(true);
    const nextPage = this.page + 1;
    const [ys, ye] = this.yearRange();

    this.api.searchImages(this.currentTerm, nextPage, ys, ye).subscribe({
      next: (imgs) => {
        if (imgs.length === 0) {
          this.hasMore.set(false);
        } else {
          this.page = nextPage;
          // Evita chaves duplicadas no @for (trackBy nasaId).
          this.images.update((cur) => {
            const seen = new Set(cur.map((i) => i.nasaId));
            return [...cur, ...imgs.filter((i) => !seen.has(i.nasaId))];
          });
          this.hasMore.set(imgs.length >= PAGE_SIZE);
        }
        this.loadingMore.set(false);
      },
      error: () => {
        // Mantém hasMore para permitir nova tentativa pelo botão/scroll.
        this.loadingMore.set(false);
      },
    });
  }

  /** year_start/year_end a partir do ano selecionado (ou vazio). */
  private yearRange(): [string?, string?] {
    const y = this.year();
    return y ? [y, y] : [undefined, undefined];
  }

  protected openLightbox(img: NasaImage): void {
    this.lightbox.set(img);
  }

  protected closeLightbox(): void {
    this.lightbox.set(null);
  }
}
