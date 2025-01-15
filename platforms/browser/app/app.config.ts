import { ApplicationConfig } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideIonicAngular } from '@ionic/angular/standalone';

export const config: ApplicationConfig = {
  providers: [provideIonicAngular(), provideClientHydration()],
};
