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
import {
  EPIC_FIRST_DATE,
  EPIC_FRAME_MS,
  EpicImage,
} from '../../core/models/epic.model';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslateService } from '../../core/i18n/translate.service';
import { ContentTranslatePipe } from '../../core/i18n/content-translate.pipe';

/**
 * Seção "Terra" (EPIC): o disco completo do planeta ao longo de um dia.
 *
 * Cada dia é uma sequência de imagens; o slider temporal as percorre e o play
 * as anima — a Terra girando devagar sob o satélite ("Terra flutuando").
 */
@Component({
  selector: 'app-earth',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TranslatePipe, ContentTranslatePipe],
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

  /** Datas válidas em Set — a busca da mais próxima roda a cada escolha. */
  private readonly dateSet = computed(() => new Set(this.dates()));

  /** Limites do campo de data (o `max` vem da própria API). */
  protected readonly minDate = EPIC_FIRST_DATE;
  protected readonly maxDate = computed(() => this.dates().at(-1) ?? '');

  /**
   * Data pedida ≠ data exibida: o arquivo tem buracos (3.566 datas em ~11
   * anos), então uma escolha sem imagem é ajustada para a válida mais próxima
   * — e isso precisa ser dito, senão o usuário acha que o campo ignorou ele.
   */
  protected readonly adjustedFrom = signal<string | null>(null);

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
        // A lista inteira (3.566 datas): o campo de data usa os extremos e o
        // Set para achar a mais próxima. Antes o app cortava em 60 — 98% do
        // arquivo ficava inalcançável.
        this.dates.set([...dates].sort());
        this.date.set(this.dates().at(-1) ?? '');
        this.loadImages();
      },
      error: () => {
        this.error.set('earth.error');
        this.loading.set(false);
      },
    });
  }

  protected onDateChange(value: string): void {
    if (!value) {
      return;
    }
    const valid = this.nearestDate(value);
    if (!valid) {
      return;
    }
    this.adjustedFrom.set(valid === value ? null : value);
    this.date.set(valid);
    this.loadImages();
  }

  /** Data válida mais próxima (empate → a mais recente). */
  private nearestDate(wanted: string): string | null {
    const all = this.dates();
    if (!all.length) {
      return null;
    }
    if (this.dateSet().has(wanted)) {
      return wanted;
    }
    const target = Date.parse(wanted + 'T00:00:00Z');
    if (isNaN(target)) {
      return null;
    }
    let best = all[0];
    let bestDiff = Infinity;
    for (const d of all) {
      const diff = Math.abs(Date.parse(d + 'T00:00:00Z') - target);
      // <= mantém a mais recente no empate (a lista está ordenada).
      if (diff <= bestDiff) {
        bestDiff = diff;
        best = d;
      }
    }
    return best;
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

  // ── Exportar a sequência do dia (.webm) ─────────────────────────────────
  /**
   * Grava os quadros num canvas com `MediaRecorder` — API nativa, **sem
   * dependência** (uma lib de GIF traria ~30 KB + worker, e GIF de 20 quadros
   * 2048² sairia enorme e com 256 cores).
   *
   * Só aparece onde o navegador sabe gravar (`canSaveVideo`): o Safari tem
   * suporte irregular a MediaRecorder/webm.
   */
  protected readonly canSaveVideo = ((): boolean => {
    if (typeof MediaRecorder === 'undefined') {
      return false;
    }
    return EXPORT_MIMES.some((m) => MediaRecorder.isTypeSupported(m));
  })();

  protected readonly saving = signal(false);
  protected readonly saveProgress = signal(0);

  protected async saveVideo(): Promise<void> {
    const frames = this.images();
    if (this.saving() || frames.length < 2 || !this.canSaveVideo) {
      return;
    }
    this.stop(); // o play concorreria com a gravação
    this.saving.set(true);
    this.saveProgress.set(0);

    try {
      const blob = await this.recordFrames(frames);
      this.downloadBlob(blob, `epic-${this.date()}.webm`);
    } catch {
      // Falhou? Só não exporta — a seção continua utilizável.
      this.error.set(null);
    } finally {
      this.saving.set(false);
      this.saveProgress.set(0);
    }
  }

  private async recordFrames(frames: EpicImage[]): Promise<Blob> {
    // 1024² (metade do original) equilibra nitidez e tamanho do arquivo.
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('sem canvas 2d');
    }

    const mime = EXPORT_MIMES.find((m) => MediaRecorder.isTypeSupported(m))!;
    const stream = canvas.captureStream(0);
    // captureStream(0) + requestFrame: cada quadro é enviado na mão, então a
    // duração não depende da velocidade do loop nem do relógio da máquina.
    const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) {
        chunks.push(e.data);
      }
    };
    const stopped = new Promise<void>((res) => (recorder.onstop = () => res()));
    recorder.start();

    for (const [i, frame] of frames.entries()) {
      const img = await loadImage(frame.imageUrl);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      track.requestFrame();
      this.saveProgress.set(Math.round(((i + 1) / frames.length) * 100));
      // Segura cada quadro na tela pelo mesmo tempo do play.
      await new Promise((r) => setTimeout(r, EPIC_FRAME_MS));
    }

    recorder.stop();
    await stopped;
    return new Blob(chunks, { type: mime });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    // Sem revoke o blob (dezenas de MB) fica preso na memória da aba.
    URL.revokeObjectURL(url);
  }
}

/** Preferência de formato: vp9 comprime melhor; o resto é fallback. */
const EXPORT_MIMES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

/** Carrega uma imagem já pronta para desenhar no canvas. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // O canvas fica "sujo" (e o toBlob/MediaRecorder falha) sem CORS — o
    // arquivo do EPIC responde com Access-Control-Allow-Origin.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('falhou: ' + src));
    img.src = src;
  });
}
