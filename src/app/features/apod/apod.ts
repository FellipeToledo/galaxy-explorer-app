import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NasaApiService } from '../../core/services/nasa-api.service';
import { Apod } from '../../core/models/apod.model';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { ContentTranslatePipe } from '../../core/i18n/content-translate.pipe';

@Component({
  selector: 'app-apod',
  standalone: true,
  imports: [DatePipe, TranslatePipe, ContentTranslatePipe],
  templateUrl: './apod.html',
  styleUrl: './apod.scss',
})
export class ApodComponent implements OnInit {
  private readonly api = inject(NasaApiService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly translate = inject(TranslateService);

  protected readonly apod = signal<Apod | null>(null);
  protected readonly loading = signal(true);
  /** Chave de tradução do erro (ou null). */
  protected readonly error = signal<string | null>(null);
  protected readonly selectedDate = signal<string>(this.today());

  /** URL de vídeo sanitizada para uso seguro no iframe. */
  protected readonly safeVideoUrl = computed<SafeResourceUrl | null>(() => {
    const item = this.apod();
    return item && item.media_type === 'video'
      ? this.sanitizer.bypassSecurityTrustResourceUrl(item.url)
      : null;
  });

  /** Data máxima selecionável (hoje) para o input date. */
  protected readonly maxDate = this.today();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    const date = this.selectedDate();
    const isToday = date === this.today();

    this.api.getApod(isToday ? undefined : date).subscribe({
      next: (data) => {
        this.apod.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('apod.error');
        this.loading.set(false);
      },
    });
  }

  protected onDateChange(value: string): void {
    if (value) {
      this.selectedDate.set(value);
      this.load();
    }
  }

  protected randomDate(): void {
    // APOD começou em 1995-06-16.
    const start = new Date('1995-06-16').getTime();
    const end = Date.now();
    const rand = new Date(start + Math.random() * (end - start));
    this.selectedDate.set(rand.toISOString().slice(0, 10));
    this.load();
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
