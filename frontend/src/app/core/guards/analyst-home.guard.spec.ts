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
import { analystHomeGuard } from './analyst-home.guard';

describe('analystHomeGuard', () => {
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
      analystHomeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('sends an analyst to the analyst view', async () => {
    profileService.getCurrentProfile.mockResolvedValue({ userType: USER_TYPE.ANALYST });

    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/analyst');
  });

  it.each([
    ['retail client', USER_TYPE.RETAIL_CLIENT],
    ['admin', USER_TYPE.ADMIN],
    ['auditor', USER_TYPE.AUDITOR],
  ])('lets a %s open the dashboard', async (_label, userType) => {
    profileService.getCurrentProfile.mockResolvedValue({ userType });

    expect(await runGuard()).toBe(true);
  });

  it('lets the dashboard handle a profile that cannot be loaded', async () => {
    profileService.getCurrentProfile.mockRejectedValue(new Error('network'));

    expect(await runGuard()).toBe(true);
  });
});
