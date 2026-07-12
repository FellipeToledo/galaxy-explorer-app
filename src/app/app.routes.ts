import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/apod/apod').then((m) => m.ApodComponent),
    title: 'Galaxy Explorer · Foto do Dia',
  },
  {
    path: 'mars',
    loadComponent: () =>
      import('./features/mars/mars').then((m) => m.MarsComponent),
    title: 'Galaxy Explorer · Marte',
  },
  { path: '**', redirectTo: '' },
];
