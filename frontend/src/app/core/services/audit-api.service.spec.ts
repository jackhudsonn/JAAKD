import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@environments/environment.local';
import { AuditApiService } from './audit-api.service';

describe('AuditApiService', () => {
  let service: AuditApiService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuditApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuditApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('searchUsers sends trimmed query and paging params', async () => {
    const promise = service.searchUsers('  auditor@example.com  ', { page: 2, size: 50 });

    const req = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiUrl}/api/audit/users`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('query')).toBe('auditor@example.com');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('50');

    req.flush([
      {
        userId: 'user-1',
        email: 'auditor@example.com',
        username: 'auditor',
        firstName: 'Audit',
        lastName: 'User',
      },
    ]);

    await expect(promise).resolves.toHaveLength(1);
  });

  it('searchOrderLogs includes optional date and optional filters', async () => {
    const promise = service.searchOrderLogs({
      date: '2026-10-14',
      userId: 'user-1',
      status: 'EXECUTED',
      ticker: '  AAPL  ',
      instrumentId: 'instrument-123',
      instrumentType: 'EQUITY',
      page: 0,
      size: 25,
    });

    const req = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiUrl}/api/audit/order-logs`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('date')).toBe('2026-10-14');
    expect(req.request.params.get('userId')).toBe('user-1');
    expect(req.request.params.get('status')).toBe('EXECUTED');
    expect(req.request.params.get('ticker')).toBe('AAPL');
    expect(req.request.params.get('instrumentId')).toBe('instrument-123');
    expect(req.request.params.get('instrumentType')).toBe('EQUITY');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('25');

    req.flush([]);

    await expect(promise).resolves.toEqual([]);
  });

  it('searchOrderLogs omits blank optional filters including date and instrumentId', async () => {
    const promise = service.searchOrderLogs({
      date: '   ',
      ticker: '   ',
      instrumentId: '   ',
    });

    const req = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiUrl}/api/audit/order-logs`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('date')).toBe(false);
    expect(req.request.params.has('ticker')).toBe(false);
    expect(req.request.params.has('instrumentId')).toBe(false);
    expect(req.request.params.has('userId')).toBe(false);
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('instrumentType')).toBe(false);

    req.flush([]);

    await expect(promise).resolves.toEqual([]);
  });

  it('listUserPortfolios sends GET with paging params', async () => {
    const promise = service.listUserPortfolios('user-1', { page: 1, size: 10 });

    const req = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiUrl}/api/audit/users/user-1/portfolios`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('10');

    req.flush([{ portfolioId: 'portfolio-1', portfolioName: 'Main' }]);

    await expect(promise).resolves.toHaveLength(1);
  });

  it('listUserHoldings includes optional portfolio filter', async () => {
    const promise = service.listUserHoldings('user-1', {
      portfolioId: 'portfolio-1',
      page: 0,
      size: 25,
    });

    const req = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiUrl}/api/audit/users/user-1/holdings`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('portfolioId')).toBe('portfolio-1');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('25');

    req.flush([]);

    await expect(promise).resolves.toEqual([]);
  });

  it('listHoldingPositionLots and listHoldingLotMatches target expected endpoints', async () => {
    const lotsPromise = service.listHoldingPositionLots('holding-1', { page: 3, size: 5 });
    const lotsReq = httpTestingController.expectOne(
      (request) =>
        request.url === `${environment.apiUrl}/api/audit/holdings/holding-1/position-lots`,
    );
    expect(lotsReq.request.method).toBe('GET');
    expect(lotsReq.request.params.get('page')).toBe('3');
    expect(lotsReq.request.params.get('size')).toBe('5');
    lotsReq.flush([]);

    const matchesPromise = service.listHoldingLotMatches('holding-1', { page: 4, size: 6 });
    const matchesReq = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiUrl}/api/audit/holdings/holding-1/lot-matches`,
    );
    expect(matchesReq.request.method).toBe('GET');
    expect(matchesReq.request.params.get('page')).toBe('4');
    expect(matchesReq.request.params.get('size')).toBe('6');
    matchesReq.flush([]);

    await expect(lotsPromise).resolves.toEqual([]);
    await expect(matchesPromise).resolves.toEqual([]);
  });
});
