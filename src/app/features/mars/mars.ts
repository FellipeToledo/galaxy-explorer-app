import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

/** Tamanho de página padrão da NASA Image and Video Library. */
const PAGE_SIZE = 100;
/** Primeiro ano com imagens de rovers em Marte (Spirit/Opportunity, 2004). */
const FIRST_YEAR = 2004;

@Component({
  selector: 'app-mars',
  standalone: true,
  imports: [DatePipe, InViewDirective, ScrollEndDirective],
  templateUrl: './mars.html',
  styleUrl: './mars.scss',
})
export class MarsComponent implements OnInit {
  private readonly api = inject(NasaApiService);

  protected readonly rovers = ROVERS;
  protected readonly sortOptions = SORT_OPTIONS;
  /** Anos disponíveis para o filtro (atual → 2004), descendente. */
  protected readonly years = ((): string[] => {
    const now = new Date().getFullYear();
    const list: string[] = [];
    for (let y = now; y >= FIRST_YEAR; y--) {
      list.push(String(y));
    }
    return list;
  })();

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

  protected onSearch(term: string): void {
    const trimmed = term.trim();
    if (!trimmed) {
      return;
    }
    this.rover.set(null);
    this.search(trimmed);
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
        this.error.set(
          'Não foi possível carregar as imagens. Verifique sua conexão e tente novamente.',
        );
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
