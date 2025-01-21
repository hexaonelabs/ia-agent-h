import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
@Injectable()
export class SseSubjectService {
  private userSubjects: Map<string, Subject<MessageEvent>> = new Map();

  getUserSubject$(userId: string): Observable<MessageEvent> {
    if (!this.userSubjects.has(userId)) {
      this.userSubjects.set(userId, new Subject<MessageEvent>());
    }
    return this.userSubjects.get(userId).asObservable();
  }

  sendEventToUser(userId: string, event: MessageEvent) {
    const userSubject = this.userSubjects.get(userId);
    if (userSubject) {
      userSubject.next(event);
    }
  }

  removeUser(userId: string) {
    this.userSubjects.delete(userId);
  }
}
