import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NasaApiService } from '../../core/services/nasa-api.service';
import { EPIC_FRAME_MS, EpicImage } from '../../core/models/epic.model';
import {
  GlassSelectComponent,
  SelectOption,
} from '../../shared/glass-select/glass-select';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { ContentTranslatePipe } from '../../core/i18n/content-translate.pipe';

/** Quantas datas do arquivo entram no seletor (a lista completa tem milhares). */
const MAX_DATES = 60;

/**
 * Seção "Terra" (EPIC): o disco completo do planeta ao longo de um dia.
 *
 * Cada dia é uma sequência de imagens; o slider temporal as percorre e o play
 * as anima — a Terra girando devagar sob o satélite ("Terra flutuando").
 */
@Component({
  selector: 'app-earth',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    GlassSelectComponent,
    TranslatePipe,
    ContentTranslatePipe,
  ],
  templateUrl: './earth.html',
  styleUrl: './earth.scss',
})
export class EarthComponent implements OnInit, OnDestroy {
  private readonly api = inject(NasaApiService);
  protected readonly translate = inject(TranslateService);

  protected readonly images = signal<EpicImage[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly date = signal<string>('');
  protected readonly dates = signal<string[]>([]);

  /** Quadro atual da sequência. */
  protected readonly index = signal(0);
  protected readonly playing = signal(false);
  /** Quadros já baixados — o play só roda liso depois do pré-carregamento. */
  protected readonly loadedCount = signal(0);

  private timer: ReturnType<typeof setInterval> | null = null;

  protected readonly dateOptions = computed<SelectOption[]>(() =>
    this.dates().map((d) => ({ label: d, value: d })),
  );

  protected readonly current = computed<EpicImage | null>(
    () => this.images()[this.index()] ?? null,
  );

  protected readonly frameCount = computed(() => this.images().length);

  /** Progresso do pré-carregamento (0–100) para a barra sob a imagem. */
  protected readonly preloadPct = computed(() => {
    const total = this.frameCount();
    return total ? Math.round((this.loadedCount() / total) * 100) : 0;
  });

  protected readonly ready = computed(
    () => this.frameCount() > 0 && this.loadedCount() >= this.frameCount(),
  );

  ngOnInit(): void {
    this.loadDates();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  /** Datas disponíveis; a mais recente vira a seleção inicial. */
  private loadDates(): void {
    this.api.getEpicDates().subscribe({
      next: (dates) => {
        const list = dates.slice(0, MAX_DATES);
        this.dates.set(list);
        this.date.set(list[0] ?? '');
        this.loadImages();
      },
      error: () => {
        this.error.set('earth.error');
        this.loading.set(false);
      },
    });
  }

  protected onDateChange(value: string): void {
    this.date.set(value);
    this.loadImages();
  }

  protected retry(): void {
    this.error.set(null);
    this.dates().length ? this.loadImages() : this.loadDates();
  }

  private loadImages(): void {
    this.stop();
    this.loading.set(true);
    this.error.set(null);
    this.index.set(0);
    this.loadedCount.set(0);

    this.api.getEpicImages(this.date() || undefined).subscribe({
      next: (imgs) => {
        this.images.set(imgs);
        this.loading.set(false);
        this.preload(imgs);
      },
      error: () => {
        this.error.set('earth.error');
        this.loading.set(false);
      },
    });
  }

  /**
   * Baixa os quadros em segundo plano. Sem isso, o play pisca em branco no
   * primeiro ciclo, enquanto cada imagem ainda está sendo buscada.
   */
  private preload(imgs: EpicImage[]): void {
    for (const img of imgs) {
      const el = new Image();
      // Conta erro como concluído: um quadro quebrado não pode travar o play.
      el.onload = el.onerror = () => this.loadedCount.update((n) => n + 1);
      el.src = img.imageUrl;
    }
  }

  protected onSliderInput(value: string): void {
    this.stop();
    this.index.set(Number(value));
  }

  protected step(delta: number): void {
    this.stop();
    const total = this.frameCount();
    if (total) {
      this.index.set((this.index() + delta + total) % total);
    }
  }

  protected togglePlay(): void {
    this.playing() ? this.stop() : this.play();
  }

  private play(): void {
    if (this.frameCount() < 2) {
      return;
    }
    this.playing.set(true);
    this.timer = setInterval(() => {
      this.index.update((i) => (i + 1) % this.frameCount());
    }, EPIC_FRAME_MS);
  }

  private stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.playing.set(false);
  }
}
