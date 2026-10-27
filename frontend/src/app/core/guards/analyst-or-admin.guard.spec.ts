import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { USER_TYPE } from '@core/models/profile.model';
import { ProfileService } from '@features/profile/services/profile.service';
import { analystOrAdminGuard } from './analyst-or-admin.guard';

describe('analystOrAdminGuard', () => {
  const profileService = {
    getCurrentProfile: vi.fn<() => Promise<{ userType: number }>>(),
  };

  beforeEach(() => {
    profileService.getCurrentProfile.mockReset();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ProfileService, useValue: profileService }],
    });
  });

  function runGuard() {
    return TestBed.runInInjectionContext(() =>
      analystOrAdminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  function expectDashboardRedirect(result: unknown) {
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/dashboard');
  }

  it.each([
    ['analyst', USER_TYPE.ANALYST],
    ['admin', USER_TYPE.ADMIN],
  ])('allows an %s', async (_label, userType) => {
    profileService.getCurrentProfile.mockResolvedValue({ userType });

    expect(await runGuard()).toBe(true);
  });

  it.each([
    ['retail client', USER_TYPE.RETAIL_CLIENT],
    ['auditor', USER_TYPE.AUDITOR],
  ])('redirects a %s to the dashboard', async (_label, userType) => {
    profileService.getCurrentProfile.mockResolvedValue({ userType });

    expectDashboardRedirect(await runGuard());
  });

  it('redirects to the dashboard when the profile cannot be loaded', async () => {
    profileService.getCurrentProfile.mockRejectedValue(new Error('network'));

    expectDashboardRedirect(await runGuard());
  });
});
