import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonRow,
  IonText,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
} from '@ionic/angular/standalone';
// import AOS from 'aos';
// import 'aos/dist/aos.css';

const UIElements = [
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonText,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
];

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [CommonModule, ...UIElements],
  templateUrl: './main-page.component.html',
  styleUrl: './main-page.component.scss',
})
export class MainPageComponent implements OnInit {
  ngOnInit() {
    // AOS.init({
    //   duration: 1000,
    //   once: true,
    //   easing: 'ease-out',
    // });
  }

  async getStarted() {
    window.open('https://github.com/hexaonelabs/ia-agent-h', '_blank');
  }
}
