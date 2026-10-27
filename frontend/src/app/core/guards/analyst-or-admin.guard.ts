import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isAnalystOrAdmin } from '@core/models/profile.model';
import { ProfileService } from '@features/profile/services/profile.service';

// UI-only gate; the backend still enforces access on /api/analytics/** via @RequiresUserType.
export const analystOrAdminGuard: CanActivateFn = async () => {
  const profileService = inject(ProfileService);
  const router = inject(Router);

  try {
    const profile = await profileService.getCurrentProfile();
    if (isAnalystOrAdmin(profile.userType)) {
      return true;
    }
  } catch {
    // Fall through to redirect when the profile can't be loaded.
  }

  return router.createUrlTree(['/dashboard']);
};
