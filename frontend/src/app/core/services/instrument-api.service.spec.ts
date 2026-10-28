import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InstrumentApiService } from './instrument-api.service';
import { environment } from '@environments/environment.local';

describe('InstrumentApiService', () => {
  let service: InstrumentApiService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InstrumentApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(InstrumentApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('list sends GET /api/instruments', async () => {
    const promise = service.list();

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/instruments`);
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        instrumentId: 'i1',
        ticker: 'AAPL',
        market: 'NASDAQ',
        name: 'Apple Inc.',
        instrumentClass: 'EQUITY',
        logoUrl: null,
        description: null,
      },
    ]);

    await expect(promise).resolves.toHaveLength(1);
  });

  it('getQuotes sends GET /api/instruments/quotes with the symbols', async () => {
    const promise = service.getQuotes(['AAPL', 'MSFT']);

    const req = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiUrl}/api/instruments/quotes`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('symbols')).toBe('AAPL,MSFT');
    req.flush([]);

    await expect(promise).resolves.toEqual([]);
  });

  it('getQuotes makes no request when there are no symbols', async () => {
    await expect(service.getQuotes([])).resolves.toEqual([]);
  });

  it('getCandles requests the instrument candle series and date bounds', async () => {
    const promise = service.getCandles('instrument-1', '2025-01-01', '2025-12-31');

    const req = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiUrl}/api/instruments/instrument-1/candles`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2025-01-01');
    expect(req.request.params.get('to')).toBe('2025-12-31');
    req.flush([]);

    await expect(promise).resolves.toEqual([]);
  });
});
