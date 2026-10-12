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
        quotedPrice: null,
      },
    ]);

    await expect(promise).resolves.toHaveLength(1);
  });

  it('submit sends POST /api/order-logs with request body', async () => {
    const requestBody = {
      orderId: 'o2',
      portfolioId: 'portfolio-1',
      instrumentId: 'i1',
      side: 'BUY' as const,
      quantity: 5,
      metadata: 'source=trade',
    };
    const promise = service.submit(requestBody);

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/order-logs`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(requestBody);
    req.flush({
      logOrderId: 'l2',
      orderId: 'o2',
      portfolioId: 'portfolio-1',
      instrumentId: 'i1',
      side: 'BUY',
      quantity: 5,
      timestamp: '2026-10-01T00:01:00Z',
      metadata: 'source=trade',
      status: 'SUBMITTED',
      executionPrice: 0,
      quotedPrice: 123.45,
    });

    await expect(promise).resolves.toMatchObject({ orderId: 'o2' });
  });

  it('cancel sends POST /api/order-logs/{orderId}/cancel with empty body', async () => {
    const promise = service.cancel('o2');

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/order-logs/o2/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({
      logOrderId: 'l3',
      orderId: 'o2',
      portfolioId: 'portfolio-1',
      instrumentId: 'i1',
      side: 'BUY',
      quantity: 5,
      timestamp: '2026-10-01T00:02:00Z',
      metadata: null,
      status: 'CANCELLED',
      executionPrice: 0,
      quotedPrice: 123.45,
    });

    await expect(promise).resolves.toMatchObject({ status: 'CANCELLED' });
  });
});
