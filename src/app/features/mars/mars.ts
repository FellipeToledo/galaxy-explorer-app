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
import { ROVERS, RoverCamera, RoverName } from '../../core/models/mars.model';
import {
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

/** Tamanho de página padrão da NASA Image and Video Library. */
const PAGE_SIZE = 100;
/** Primeiro ano com imagens de rovers em Marte (Spirit/Opportunity, 2004). */
const FIRST_YEAR = 2004;

/** Espera antes de pedir sugestões — evita um request por tecla. */
const SUGGEST_DEBOUNCE_MS = 320;
/** Abaixo disso, sugestão da API é ruído: mostramos a lista curada. */
const SUGGEST_MIN_CHARS = 3;

/**
 * Sugestões curadas — usadas com o campo vazio ou com termo muito curto (a API
 * só entra a partir de 3 caracteres) e como rede de segurança se ela falhar.
 */
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
    ScrollEndDirective,
    MediaCardComponent,
    MediaLightboxComponent,
    GlassSelectComponent,
    TranslatePipe,
  ],
  templateUrl: './mars.html',
  styleUrl: './mars.scss',
})
export class MarsComponent implements OnInit {
  private readonly api = inject(NasaApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
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

  protected readonly images = signal<NasaMedia[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly error = signal<string | null>(null);

  private currentTerm = '';
  private page = 1;

  protected readonly rover = signal<RoverName | null>('perseverance');
  /** Câmera do rover atual ('' = todas). Só vale com um rover selecionado. */
  protected readonly camera = signal<string>('');
  protected readonly query = signal<string>('');

  /** Câmeras do rover atual — vazio na busca livre, aí os chips somem. */
  protected readonly cameras = computed<RoverCamera[]>(
    () => this.rovers.find((r) => r.name === this.rover())?.cameras ?? [],
  );
  /** Ano selecionado ('' = todos). */
  protected readonly year = signal<string>('');
  /** Ordenação client-side (a API só entrega por relevância). */
  protected readonly sort = signal<SortMode>('relevance');

  // ── Autocomplete da busca ──
  protected readonly searchQuery = signal('');
  protected readonly showSuggestions = signal(false);
  protected readonly suggestionIndex = signal(-1);
  /** Sugestões vindas da API (vazio → cai na lista curada). */
  private readonly apiSuggestions = signal<string[]>([]);
  protected readonly suggestLoading = signal(false);

  /** Termo digitado empurrado para o pipeline de sugestões (debounce). */
  private readonly suggestTerm = new Subject<string>();

  protected readonly filteredSuggestions = computed<string[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const fromApi = this.apiSuggestions();
    if (q.length >= SUGGEST_MIN_CHARS && fromApi.length) {
      return fromApi;
    }
    // Curadas: com campo vazio, termo curto ou quando a API não trouxe nada.
    const list = q
      ? SEARCH_SUGGESTIONS.filter(
          (s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q,
        )
      : SEARCH_SUGGESTIONS;
    return list.slice(0, 8);
  });

  /** Imagens já ordenadas conforme o modo escolhido (sem novo request). */
  protected readonly sortedImages = computed<NasaMedia[]>(() => {
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

  /** Item ampliado no lightbox (ou null) — o componente cuida dos assets. */
  protected readonly lightbox = signal<NasaMedia | null>(null);

  ngOnInit(): void {
    this.runRoverSearch();
    this.watchSuggestions();
  }

  /**
   * Pipeline das sugestões: espera o usuário parar de digitar, ignora termos
   * curtos e **cancela o request anterior** (switchMap) — sem isso, respostas
   * fora de ordem sobrescreveriam a sugestão do termo atual.
   */
  private watchSuggestions(): void {
    this.suggestTerm
      .pipe(
        debounceTime(SUGGEST_DEBOUNCE_MS),
        distinctUntilChanged(),
        tap((term) => this.suggestLoading.set(term.length >= SUGGEST_MIN_CHARS)),
        switchMap((term) => {
          if (term.length < SUGGEST_MIN_CHARS) {
            return of<string[]>([]);
          }
          // Erro aqui não pode quebrar a busca: cai na lista curada.
          return this.api.suggest(term).pipe(catchError(() => of<string[]>([])));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => {
        this.apiSuggestions.set(list);
        this.suggestLoading.set(false);
      });
  }

  protected selectRover(name: RoverName): void {
    this.rover.set(name);
    // Cada rover tem suas câmeras: manter a anterior deixaria um chip ativo
    // que não existe no rover novo.
    this.camera.set('');
    this.query.set('');
    this.runRoverSearch();
  }

  /** Chip de câmera: refina a busca do rover (clicar no ativo desmarca). */
  protected selectCamera(id: string): void {
    this.camera.set(this.camera() === id ? '' : id);
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
    this.suggestTerm.next(value.trim());
  }

  /** Enter/botão de busca: dispara a busca com o termo digitado. */
  protected submitSearch(): void {
    const term = this.searchQuery().trim();
    if (!term) {
      return;
    }
    this.showSuggestions.set(false);
    this.rover.set(null);
    this.camera.set('');
    this.search(term);
  }

  protected selectSuggestion(term: string): void {
    this.searchQuery.set(term);
    this.showSuggestions.set(false);
    this.suggestionIndex.set(-1);
    this.rover.set(null);
    this.camera.set('');
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

  /** Monta a busca a partir do rover + câmera atuais e dispara. */
  private runRoverSearch(): void {
    const rover = this.rovers.find((r) => r.name === this.rover());
    // A câmera entra como termo extra: a API não tem campo de câmera, então
    // ela casa no texto (título/descrição) do item.
    const term = [rover?.query ?? 'Mars', this.camera()].filter(Boolean).join(' ');
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

  protected openLightbox(img: NasaMedia): void {
    this.lightbox.set(img);
  }

  protected closeLightbox(): void {
    this.lightbox.set(null);
  }
}
