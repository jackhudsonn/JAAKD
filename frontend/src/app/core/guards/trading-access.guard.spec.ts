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
import { tradingAccessGuard } from './trading-access.guard';

describe('tradingAccessGuard', () => {
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
      tradingAccessGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  function expectRedirect(result: unknown, url: string) {
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(url);
  }

  it.each([
    ['retail client', USER_TYPE.RETAIL_CLIENT],
    ['admin', USER_TYPE.ADMIN],
  ])('allows a %s', async (_label, userType) => {
    profileService.getCurrentProfile.mockResolvedValue({ userType });

    expect(await runGuard()).toBe(true);
  });

  it('sends an auditor to the auditor portal', async () => {
    profileService.getCurrentProfile.mockResolvedValue({ userType: USER_TYPE.AUDITOR });

    expectRedirect(await runGuard(), '/testing/auditor');
  });

  it('sends an analyst to the analyst view', async () => {
    profileService.getCurrentProfile.mockResolvedValue({ userType: USER_TYPE.ANALYST });

    expectRedirect(await runGuard(), '/analyst');
  });

  it('lets the guarded page handle a profile that cannot be loaded', async () => {
    profileService.getCurrentProfile.mockRejectedValue(new Error('network'));

    expect(await runGuard()).toBe(true);
  });
});
