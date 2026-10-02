import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrderLogApiService } from './order-log-api.service';
import { environment } from '@environments/environment.local';

describe('OrderLogApiService', () => {
  let service: OrderLogApiService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OrderLogApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(OrderLogApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('listByPortfolio sends GET /api/order-logs/portfolio/{portfolioId}', async () => {
    const promise = service.listByPortfolio('portfolio-1');

    const req = httpTestingController.expectOne(
      `${environment.apiUrl}/api/order-logs/portfolio/portfolio-1`,
    );
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        logOrderId: 'l1',
        orderId: 'o1',
        portfolioId: 'portfolio-1',
        instrumentId: 'i1',
        side: 'BUY',
        quantity: 1,
        timestamp: '2026-10-01T00:00:00Z',
        metadata: null,
        status: 'SUBMITTED',
        executionPrice: 0,
      },
    ]);

    await expect(promise).resolves.toHaveLength(1);
  });
});
