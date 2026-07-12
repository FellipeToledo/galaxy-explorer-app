import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { NasaApiService } from '../../core/services/nasa-api.service';
import {
  MarsPhoto,
  MarsPhotosResponse,
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
  /** Data terrestre selecionada (vazia = usando as fotos mais recentes). */
  protected readonly earthDate = signal<string>('');
  /** true enquanto exibindo as fotos mais recentes (sem filtro de data). */
  protected readonly showingLatest = signal(true);

  /** Foto ampliada no lightbox (ou null). */
  protected readonly lightbox = signal<MarsPhoto | null>(null);

  ngOnInit(): void {
    this.loadLatest();
  }

  /** Carrega as fotos mais recentes do rover atual. */
  protected loadLatest(): void {
    this.loading.set(true);
    this.error.set(null);
    this.showingLatest.set(true);

    this.api.getMarsLatestPhotos(this.rover()).subscribe({
      next: (res) => {
        this.applyPhotos(res);
        // Sincroniza o seletor com a data das fotos mais recentes.
        this.earthDate.set(res.photos[0]?.earth_date ?? '');
        this.loading.set(false);
      },
      error: (err) => this.handleError(err),
    });
  }

  /** Carrega as fotos de uma data terrestre específica. */
  protected loadByDate(): void {
    if (!this.earthDate()) {
      this.loadLatest();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.showingLatest.set(false);

    this.api.getMarsPhotos(this.rover(), this.earthDate()).subscribe({
      next: (res) => {
        this.applyPhotos(res);
        this.loading.set(false);
      },
      error: (err) => this.handleError(err),
    });
  }

  protected selectRover(name: RoverName): void {
    if (name !== this.rover()) {
      this.rover.set(name);
      // Ao trocar de rover, volta para as fotos mais recentes dele.
      this.loadLatest();
    }
  }

  protected onDateChange(value: string): void {
    if (value) {
      this.earthDate.set(value);
      this.loadByDate();
    }
  }

  protected retry(): void {
    this.showingLatest() ? this.loadLatest() : this.loadByDate();
  }

  protected openLightbox(photo: MarsPhoto): void {
    this.lightbox.set(photo);
  }

  protected closeLightbox(): void {
    this.lightbox.set(null);
  }

  private applyPhotos(res: MarsPhotosResponse): void {
    this.photos.set(res.photos ?? []);
  }

  private handleError(err: unknown): void {
    // 404 na API de Marte = não há fotos para esse rover/data.
    // Tratamos como estado vazio, não como erro de verdade.
    if (err instanceof HttpErrorResponse && err.status === 404) {
      this.photos.set([]);
      this.error.set(null);
    } else {
      this.error.set(
        'Não foi possível carregar as fotos. Verifique sua conexão, a chave da API ou o limite de requisições.',
      );
    }
    this.loading.set(false);
  }
}
