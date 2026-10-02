import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PortfolioApiService } from './portfolio-api.service';
import { environment } from '@environments/environment.local';

describe('PortfolioApiService', () => {
  let service: PortfolioApiService;
  let httpTestingController: HttpTestingController;

  const flushMicrotaskQueue = async (): Promise<void> => {
    await Promise.resolve();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PortfolioApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(PortfolioApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('list sends GET /api/portfolios', async () => {
    const promise = service.list();

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/portfolios`);
    expect(req.request.method).toBe('GET');
    req.flush([{ portfolioId: 'p1', portfolioName: 'Main' }]);

    await expect(promise).resolves.toEqual([{ portfolioId: 'p1', portfolioName: 'Main' }]);
  });

  it('create sends POST /api/portfolios', async () => {
    const promise = service.create('Main');

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/portfolios`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ portfolioName: 'Main' });
    req.flush({ portfolioId: 'p1', portfolioName: 'Main' });

    await expect(promise).resolves.toEqual({ portfolioId: 'p1', portfolioName: 'Main' });
  });

  it('ensureDefault returns first portfolio when list is non-empty and does not POST', async () => {
    const promise = service.ensureDefault();

    const getReq = httpTestingController.expectOne(`${environment.apiUrl}/api/portfolios`);
    expect(getReq.request.method).toBe('GET');
    getReq.flush([{ portfolioId: 'p1', portfolioName: 'Existing' }]);

    httpTestingController.expectNone(`${environment.apiUrl}/api/portfolios`);

    await expect(promise).resolves.toEqual({ portfolioId: 'p1', portfolioName: 'Existing' });
  });

  it('ensureDefault sends POST only when list is empty', async () => {
    const promise = service.ensureDefault();

    const getReq = httpTestingController.expectOne(`${environment.apiUrl}/api/portfolios`);
    expect(getReq.request.method).toBe('GET');
    getReq.flush([]);

    await flushMicrotaskQueue();

    const postReq = httpTestingController.expectOne(`${environment.apiUrl}/api/portfolios`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ portfolioName: 'Main' });
    postReq.flush({ portfolioId: 'p2', portfolioName: 'Main' });

    await expect(promise).resolves.toEqual({ portfolioId: 'p2', portfolioName: 'Main' });
  });

  it('parallel ensureDefault calls send one POST only', async () => {
    const promise1 = service.ensureDefault();
    const promise2 = service.ensureDefault();

    const getReqs = httpTestingController.match(`${environment.apiUrl}/api/portfolios`);
    expect(getReqs.length).toBe(1);
    expect(getReqs[0].request.method).toBe('GET');
    getReqs[0].flush([]);

    await flushMicrotaskQueue();

    const postReqs = httpTestingController.match(`${environment.apiUrl}/api/portfolios`);
    expect(postReqs.length).toBe(1);
    expect(postReqs[0].request.method).toBe('POST');
    expect(postReqs[0].request.body).toEqual({ portfolioName: 'Main' });
    postReqs[0].flush({ portfolioId: 'p3', portfolioName: 'Main' });

    const [result1, result2] = await Promise.all([promise1, promise2]);
    expect(result1).toEqual({ portfolioId: 'p3', portfolioName: 'Main' });
    expect(result2).toEqual({ portfolioId: 'p3', portfolioName: 'Main' });
  });
});
