import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NasaApiService } from '../../core/services/nasa-api.service';
import { NasaImage, ROVERS, RoverName } from '../../core/models/mars.model';

@Component({
  selector: 'app-mars',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './mars.html',
  styleUrl: './mars.scss',
})
export class MarsComponent implements OnInit {
  private readonly api = inject(NasaApiService);

  protected readonly rovers = ROVERS;
  protected readonly images = signal<NasaImage[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly rover = signal<RoverName | null>('perseverance');
  protected readonly query = signal<string>('');

  /** Imagem ampliada no lightbox (ou null). */
  protected readonly lightbox = signal<NasaImage | null>(null);

  ngOnInit(): void {
    this.selectRover('perseverance');
  }

  protected selectRover(name: RoverName): void {
    this.rover.set(name);
    const rover = this.rovers.find((r) => r.name === name);
    this.query.set('');
    this.search(rover?.query ?? name);
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
    const rover = this.rovers.find((r) => r.name === this.rover());
    this.search(rover?.query ?? this.query() ?? 'Mars rover');
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
