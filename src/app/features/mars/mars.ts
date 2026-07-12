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

@Component({
  selector: 'app-mars',
  standalone: true,
  imports: [DatePipe, InViewDirective],
  templateUrl: './mars.html',
  styleUrl: './mars.scss',
})
export class MarsComponent implements OnInit {
  private readonly api = inject(NasaApiService);

  protected readonly rovers = ROVERS;
  protected readonly categories = MARS_CATEGORIES;

  protected readonly images = signal<NasaImage[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

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
    this.loading.set(true);
    this.error.set(null);

    this.api.searchImages(term).subscribe({
      next: (imgs) => {
        this.images.set(imgs);
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

  protected openLightbox(img: NasaImage): void {
    this.lightbox.set(img);
  }

  protected closeLightbox(): void {
    this.lightbox.set(null);
  }
}
