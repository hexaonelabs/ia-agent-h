import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { Injectable } from '@angular/core';

export interface MessageData {
  chat?: {
    threadId: string;
    message: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class SseService {
  private _eventSource: EventSource | undefined;
  constructor() {}

  createEventSource(): Observable<MessageData> {
    if (this._eventSource) {
      this._eventSource.close();
    }
    const token = localStorage.getItem('token');
    this._eventSource = new EventSource(
      environment.apiEndpoint + '/sse?token=' + token,
    );
    return new Observable((observer) => {
      if (!this._eventSource) {
        throw new Error('EventSource is not initialized');
      }
      this._eventSource.onmessage = (event) => {
        const messageData: MessageData = JSON.parse(event.data);
        console.log('Received message from sse: ', messageData);
        observer.next(messageData);
      };
    });
  }

  close() {
    if (!this._eventSource) {
      return;
    }
    this._eventSource.close();
    this._eventSource = undefined;
  }
}
