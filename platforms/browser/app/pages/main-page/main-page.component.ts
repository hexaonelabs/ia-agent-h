import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  IonIcon,
  IonRouterLink,
  IonSkeletonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowForward, logoX, logoGithub, openOutline } from 'ionicons/icons';
import { AppService } from '../../app.service';
// import AOS from 'aos';
// import 'aos/dist/aos.css';

const UIElements = [
  IonSkeletonText,
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
  IonIcon,
];

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [CommonModule, ...UIElements, RouterLink, IonRouterLink],
  templateUrl: './main-page.component.html',
  styleUrl: './main-page.component.scss',
})
export class MainPageComponent implements OnInit {
  @ViewChild(IonContent) private content!: IonContent;
  @ViewChild('aboutSection', {
    read: ElementRef,
  })
  public aboutSection!: ElementRef<IonGrid>;
  public totalWalletWorth = -1;

  constructor(private readonly _appService: AppService) {
    addIcons({
      arrowForward,
      logoX,
      logoGithub,
      openOutline,
    });
  }

  async ngOnInit() {
    this.totalWalletWorth = await this._appService.getTotalWalletWorth();
    // AOS.init({
    //   duration: 1000,
    //   once: true,
    //   easing: 'ease-out',
    // });
  }

  async getStarted() {
    window.open('https://github.com/hexaonelabs/ia-agent-h', '_blank');
  }

  /**
   * Scroll to specific position in the messages container.
   */
  async scrollToPosition(htmlElement: any) {
    console.log('scrollToPosition', htmlElement);
    this.content.scrollToPoint(0, htmlElement?.el?.offsetTop, 850);
  }
}
