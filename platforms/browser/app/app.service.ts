import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AppService {
  constructor(private readonly _http: HttpClient) {
    console.log('AppService constructor');
  }

  async ping() {
    const url = environment.apiEndpoint + '/ping';
    const request = this._http.get<{ data: string }>(url);
    const response = await firstValueFrom(request);
    return response;
  }

  async logs() {
    const url = environment.apiEndpoint + '/logs';
    const request = this._http.get<{ data: string[] }>(url);
    const response = await firstValueFrom(request);
    return response;
  }

  async prompt({
    userInput,
    threadId,
  }: {
    userInput: string;
    threadId?: string;
  }) {
    const url = environment.apiEndpoint + '/prompt';
    const request = this._http.post<{
      data: { threadId: string; message: string };
    }>(url, {
      userInput,
      threadId,
    });
    const response = await firstValueFrom(request);
    return response;
  }
}
