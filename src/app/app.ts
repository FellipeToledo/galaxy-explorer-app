import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StarfieldComponent } from './shared/starfield/starfield';
import { NavbarComponent } from './shared/navbar/navbar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, StarfieldComponent, NavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
