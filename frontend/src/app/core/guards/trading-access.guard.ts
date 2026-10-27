import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { USER_TYPE, canAccessTrading } from '@core/models/profile.model';
import { ProfileService } from '@features/profile/services/profile.service';

// UI-only gate; the backend restricts order mutations via @RequiresUserType.
export const tradingAccessGuard: CanActivateFn = async () => {
  const profileService = inject(ProfileService);
  const router = inject(Router);

  try {
    const profile = await profileService.getCurrentProfile();
    if (canAccessTrading(profile.userType)) {
      return true;
    }

    if (profile.userType === USER_TYPE.AUDITOR) {
      return router.createUrlTree(['/testing/auditor']);
    }

    if (profile.userType === USER_TYPE.ANALYST) {
      return router.createUrlTree(['/analyst']);
    }
  } catch {
    // Let the guarded page handle a profile that cannot be loaded.
  }

  return true;
};
