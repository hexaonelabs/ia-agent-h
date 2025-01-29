import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { IpcService } from './ipc.service';

const UIElements = [IonApp, IonRouterOutlet];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ...UIElements],
  template: `
    <ion-app>
      <ion-router-outlet />
    </ion-app>
  `,
})
export class App {
  constructor(private readonly ipcService: IpcService) {
    this.ipcService.on('server-running', (e) => {
      console.log('Server is running!', e);
    });
    this.ipcService.on('server-log-entry', (e) => {
      console.log('Server log entry:', e);
    });
    this.ipcService.on('show-server-log', (e) => {
      console.log('Server logs :', e);
    });
  }
}
