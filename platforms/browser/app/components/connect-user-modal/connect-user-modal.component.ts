import { Component } from '@angular/core';
import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonLabel,
  IonRow,
  IonText,
} from '@ionic/angular/standalone';
import { AppService } from '../../app.service';

const UIElements = [
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonText,
  IonLabel,
  IonButton,
];

@Component({
  selector: 'app-connect-user-modal',
  standalone: true,
  imports: [...UIElements],
  templateUrl: './connect-user-modal.component.html',
  styleUrl: './connect-user-modal.component.css',
})
export class ConnectUserModalComponent {
  constructor(public _appService: AppService) {}

  async connectWallet(btn: IonButton) {
    // btn.disabled = true;
    try {
      await this._appService.connectWalletAndAuthenticate();
    } catch (error) {
      btn.disabled = false;
    }
  }
}
