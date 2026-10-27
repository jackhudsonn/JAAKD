import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { USER_TYPE } from '@core/models/profile.model';
import { ProfileService } from '@features/profile/services/profile.service';

// Analysts don't trade, so the retail dashboard has nothing for them: send them to the analyst view instead.
// Sign-in, registration and password reset all land on /dashboard, so this covers each of them.
export const analystHomeGuard: CanActivateFn = async () => {
  const profileService = inject(ProfileService);
  const router = inject(Router);

  try {
    const profile = await profileService.getCurrentProfile();
    if (profile.userType === USER_TYPE.ANALYST) {
      return router.createUrlTree(['/analyst']);
    }
  } catch {
    // Without a profile, fall through to the dashboard, which handles it as before.
  }

  return true;
};
