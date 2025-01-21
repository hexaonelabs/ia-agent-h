import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
@Injectable()
export class SseSubjectService {
  private _sseSubject$: Subject<MessageEvent> = new Subject();

  getSubject$() {
    return this._sseSubject$.asObservable();
  }

  sendEvent(event: MessageEvent) {
    this._sseSubject$.next(event);
  }
}
