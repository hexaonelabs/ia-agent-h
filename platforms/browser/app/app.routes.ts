import { Routes } from '@angular/router';
import { MainPageComponent } from './pages/main-page/main-page.component';
import { ChatPageComponent } from './pages/chat-page/chat-page.component';
import { AuthPageComponent } from './pages/auth-page/auth-page.component';
import { SetupComponent } from './pages/setup/setup.component';

export const routes: Routes = [
  {
    path: 'index',
    component: MainPageComponent,
  },
  {
    path: 'chat',
    component: ChatPageComponent,
  },
  {
    path: 'auth',
    component: AuthPageComponent,
  },
  {
    path: 'setup',
    component: SetupComponent,
  },
  {
    path: '',
    redirectTo: '/index',
    pathMatch: 'full',
  },
];
