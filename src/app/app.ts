import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StarfieldComponent } from './shared/starfield/starfield';
import { NavbarComponent } from './shared/navbar/navbar';
import { TranslatingComponent } from './shared/translating/translating';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { TranslateService } from './core/i18n/translate.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    StarfieldComponent,
    NavbarComponent,
    TranslatingComponent,
    TranslatePipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // Instancia o serviço no bootstrap (define <html lang> e idioma salvo).
  private readonly translate = inject(TranslateService);
}
