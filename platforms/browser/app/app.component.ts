import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

const UIElements = [IonApp, IonRouterOutlet];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ...UIElements],
  host: { ngSkipHydration: 'true' },
  template: `
    <ion-app>
      <ion-router-outlet />
    </ion-app>
  `,
})
export class App {}
