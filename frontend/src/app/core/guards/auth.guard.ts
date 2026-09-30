import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getAccessToken()) {
    return true;
  }

  if (authService.hasRefreshToken()) {
    const refreshed = await authService.refresh();
    if (refreshed) {
      return true;
    }
  }

  return router.createUrlTree(['/auth/login']);
};
