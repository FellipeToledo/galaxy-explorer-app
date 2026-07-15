import { Routes } from '@angular/router';

/**
 * `title` guarda a **chave** de tradução — quem resolve é o AppTitleStrategy,
 * para o título da aba acompanhar o seletor de idioma.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/apod/apod').then((m) => m.ApodComponent),
    title: 'title.apod',
  },
  {
    path: 'mars',
    loadComponent: () =>
      import('./features/mars/mars').then((m) => m.MarsComponent),
    title: 'title.mars',
  },
  {
    path: 'asteroids',
    loadComponent: () =>
      import('./features/asteroids/asteroids').then((m) => m.AsteroidsComponent),
    title: 'title.asteroids',
  },
  {
    path: 'earth',
    loadComponent: () =>
      import('./features/earth/earth').then((m) => m.EarthComponent),
    title: 'title.earth',
  },
  { path: '**', redirectTo: '' },
];
