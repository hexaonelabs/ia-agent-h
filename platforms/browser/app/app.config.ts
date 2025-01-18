import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { routes } from './app.routes';

export const config: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideIonicAngular({
      mode: 'ios',
    }),
    provideClientHydration(),
    provideHttpClient(),
  ],
};
