import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HoldingApiService } from './holding-api.service';
import { environment } from '@environments/environment.local';

describe('HoldingApiService', () => {
  let service: HoldingApiService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HoldingApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(HoldingApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('listByPortfolio sends GET /api/holdings/portfolio/{portfolioId}', async () => {
    const promise = service.listByPortfolio('portfolio-1');

    const req = httpTestingController.expectOne(
      `${environment.apiUrl}/api/holdings/portfolio/portfolio-1`,
    );
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        holdingID: 'h1',
        portfolioID: 'portfolio-1',
        instrumentID: 'i1',
        currentQuantity: 10,
        cumulativeRealizedPnl: 0,
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ]);

    await expect(promise).resolves.toHaveLength(1);
  });
});
