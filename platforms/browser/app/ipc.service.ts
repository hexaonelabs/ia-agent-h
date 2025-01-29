import { Injectable } from '@angular/core';
// import { IpcRenderer } from 'electron';
import { ElectronAPI } from '../typings';

@Injectable({
  providedIn: 'root',
})
export class IpcService {
  private ipc: ElectronAPI | undefined;

  constructor() {
    if (window.api) {
      try {
        this.ipc = window.api;
      } catch (error) {
        console.error("Erreur lors de l'accès à ipcRenderer", error);
      }
    } else {
      console.warn("ipcRenderer n'est pas disponible");
    }
  }

  public on(channel: string, listener: (...args: any[]) => void): void {
    if (!this.ipc) {
      return;
    }
    this.ipc.on(channel, (event, ...args) => {
      listener(...args);
    });
  }

  public send(channel: string, args: any): void {
    if (!this.ipc) {
      return;
    }
    this.ipc.send(channel, args);
  }
}
