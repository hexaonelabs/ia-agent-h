import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonLabel,
  IonRow,
  IonText,
} from '@ionic/angular/standalone';

const UIElements = [
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonText,
  IonLabel,
  IonButton,
];

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, ...UIElements],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.css',
})
export class AuthPageComponent {}
