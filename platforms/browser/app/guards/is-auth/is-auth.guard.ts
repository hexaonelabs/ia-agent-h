import { CanActivateFn } from '@angular/router';

export const isAuthGuard: CanActivateFn = (route, state) => {
  return true;
};
