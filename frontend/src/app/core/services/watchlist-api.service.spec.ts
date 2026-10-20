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

  it('list sends GET /api/watchlists', async () => {
    const promise = service.list();

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/watchlists`);
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        watchlistId: 'watchlist-1',
        watchlistName: 'My Watchlist',
        items: [{ listItemId: 'w1', watchlistId: 'watchlist-1', instrumentId: 'i1' }],
      },
    ]);

    await expect(promise).resolves.toHaveLength(1);
  });

  it('createWatchlist sends POST /api/watchlists with request body', async () => {
    const requestBody = { watchlistName: 'Tech' };
    const promise = service.createWatchlist(requestBody);

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/watchlists`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(requestBody);
    req.flush({
      watchlistId: 'watchlist-2',
      watchlistName: 'Tech',
      items: [],
    });

    await expect(promise).resolves.toMatchObject({ watchlistId: 'watchlist-2' });
  });

  it('updateWatchlist sends PUT /api/watchlists/{watchlistId}', async () => {
    const promise = service.updateWatchlist('watchlist-1', { watchlistName: 'Core' });

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/watchlists/watchlist-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ watchlistName: 'Core' });
    req.flush({
      watchlistId: 'watchlist-1',
      watchlistName: 'Core',
      items: [],
    });

    await expect(promise).resolves.toMatchObject({ watchlistName: 'Core' });
  });

  it('deleteWatchlist sends DELETE /api/watchlists/{watchlistId}', async () => {
    const promise = service.deleteWatchlist('watchlist-1');

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/watchlists/watchlist-1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    req.flush(null);

    await expect(promise).resolves.toBeNull();
  });

  it('addItem sends POST /api/watchlists/{watchlistId}/items', async () => {
    const promise = service.addItem('watchlist-1', { instrumentId: 'i1' });

    const req = httpTestingController.expectOne(
      `${environment.apiUrl}/api/watchlists/watchlist-1/items`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ instrumentId: 'i1' });
    req.flush({ listItemId: 'w2', watchlistId: 'watchlist-1', instrumentId: 'i1' });

    await expect(promise).resolves.toMatchObject({ listItemId: 'w2' });
  });

  it('removeItem sends DELETE /api/watchlists/{watchlistId}/items/{listItemId}', async () => {
    const promise = service.removeItem('watchlist-1', 'w2');

    const req = httpTestingController.expectOne(
      `${environment.apiUrl}/api/watchlists/watchlist-1/items/w2`,
    );
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    req.flush(null);

    await expect(promise).resolves.toBeNull();
  });
});
