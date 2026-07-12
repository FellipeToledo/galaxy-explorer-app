import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NasaApiService } from '../../core/services/nasa-api.service';
import {
  MarsPhoto,
  ROVERS,
  RoverName,
} from '../../core/models/mars.model';

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
  protected readonly photos = signal<MarsPhoto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly rover = signal<RoverName>('curiosity');
  /** Data terrestre em que sabidamente há fotos (fallback padrão). */
  protected readonly earthDate = signal<string>('2022-06-01');

  /** Foto ampliada no lightbox (ou null). */
  protected readonly lightbox = signal<MarsPhoto | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getMarsPhotos(this.rover(), this.earthDate()).subscribe({
      next: (res) => {
        this.photos.set(res.photos ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          'Não foi possível carregar as fotos. Verifique sua chave da API ou o limite de requisições.',
        );
        this.loading.set(false);
      },
    });
  }

  protected selectRover(name: RoverName): void {
    if (name !== this.rover()) {
      this.rover.set(name);
      this.load();
    }
  }

  protected onDateChange(value: string): void {
    if (value) {
      this.earthDate.set(value);
      this.load();
    }
  }

  protected openLightbox(photo: MarsPhoto): void {
    this.lightbox.set(photo);
  }

  protected closeLightbox(): void {
    this.lightbox.set(null);
  }
}
