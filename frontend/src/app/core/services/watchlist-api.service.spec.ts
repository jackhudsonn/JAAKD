import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WatchlistApiService } from './watchlist-api.service';
import { environment } from '@environments/environment.local';

describe('WatchlistApiService', () => {
  let service: WatchlistApiService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WatchlistApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(WatchlistApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('listByPortfolio sends GET /api/watchlists/portfolio/{portfolioId}', async () => {
    const promise = service.listByPortfolio('portfolio-1');

    const req = httpTestingController.expectOne(
      `${environment.apiUrl}/api/watchlists/portfolio/portfolio-1`,
    );
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        listItemId: 'w1',
        portfolioId: 'portfolio-1',
        instrumentId: 'i1',
        name: 'Watchlist',
      },
    ]);

    await expect(promise).resolves.toHaveLength(1);
  });

  it('add sends POST /api/watchlists with request body', async () => {
    const requestBody = {
      portfolioId: 'portfolio-1',
      instrumentId: 'i1',
      name: 'Watchlist',
    };
    const promise = service.add(requestBody);

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/watchlists`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(requestBody);
    req.flush({
      listItemId: 'w2',
      portfolioId: 'portfolio-1',
      instrumentId: 'i1',
      name: 'Watchlist',
    });

    await expect(promise).resolves.toMatchObject({ listItemId: 'w2' });
  });

  it('remove sends DELETE /api/watchlists/{listItemId}', async () => {
    const promise = service.remove('w2');

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/watchlists/w2`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    req.flush(null);

    await expect(promise).resolves.toBeNull();
  });
});
