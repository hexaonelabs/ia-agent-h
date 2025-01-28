// initialize the app by request http to know if config is setup.
// if is not setup, redirect to setup page

import { HttpClient } from '@angular/common/http';
import { APP_INITIALIZER } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { Router } from '@angular/router';

const appInitializer = (http: HttpClient, router: Router) => {
  return async () => {
    console.log('appInitializer');
    const req = http.get(environment.apiEndpoint + '/is-setup');
    const response = await firstValueFrom(req).catch((err) => err);
    const currentLocationPath = window.location.pathname;
    if (!response?.success && !currentLocationPath.includes('/setup')) {
      await router.navigateByUrl('/setup');
    }
  };
};

export const provideAppInitializer = () => {
  return {
    provide: APP_INITIALIZER,
    useFactory: appInitializer,
    multi: true,
    deps: [HttpClient, Router],
  };
};
