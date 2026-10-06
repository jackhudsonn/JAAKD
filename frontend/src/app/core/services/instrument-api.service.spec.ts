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
});
