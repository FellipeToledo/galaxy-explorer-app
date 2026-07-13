import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NasaApiService } from '../../core/services/nasa-api.service';
import {
  CategoryId,
  MARS_CATEGORIES,
  NasaImage,
  ROVERS,
  RoverName,
} from '../../core/models/mars.model';
import { InViewDirective } from '../../shared/in-view/in-view';
import { ScrollEndDirective } from '../../shared/scroll-end/scroll-end';

/** Tamanho de página padrão da NASA Image and Video Library. */
const PAGE_SIZE = 100;

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
  protected readonly categories = MARS_CATEGORIES;

  protected readonly images = signal<NasaImage[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly error = signal<string | null>(null);

  private currentTerm = '';
  private page = 1;

  protected readonly rover = signal<RoverName | null>('perseverance');
  protected readonly category = signal<CategoryId>('all');
  protected readonly query = signal<string>('');

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

  protected selectCategory(id: CategoryId): void {
    this.category.set(id);
    // Categoria só refina uma busca por rover (não uma busca livre).
    if (this.rover()) {
      this.runRoverSearch();
    }
  }

  protected onSearch(term: string): void {
    const trimmed = term.trim();
    if (!trimmed) {
      return;
    }
    this.rover.set(null);
    this.category.set('all');
    this.search(trimmed);
  }

  protected retry(): void {
    this.rover() ? this.runRoverSearch() : this.search(this.query() || 'Mars');
  }

  /** Monta a busca a partir do rover atual + categoria e dispara. */
  private runRoverSearch(): void {
    const rover = this.rovers.find((r) => r.name === this.rover());
    const cat = this.categories.find((c) => c.id === this.category());
    const term = [rover?.query ?? 'Mars', cat?.modifier ?? '']
      .join(' ')
      .trim();
    this.query.set(term);
    this.search(term);
  }

  private search(term: string): void {
    this.currentTerm = term;
    this.page = 1;
    this.loading.set(true);
    this.hasMore.set(false);
    this.error.set(null);

    this.api.searchImages(term, 1).subscribe({
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

    this.api.searchImages(this.currentTerm, nextPage).subscribe({
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

  protected openLightbox(img: NasaImage): void {
    this.lightbox.set(img);
  }

  protected closeLightbox(): void {
    this.lightbox.set(null);
  }
}
