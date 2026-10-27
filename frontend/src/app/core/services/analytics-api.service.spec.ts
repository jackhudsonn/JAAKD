import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@environments/environment.local';
import { AnalyticsApiService, isAnalyticsUnavailable } from './analytics-api.service';

const BASE = `${environment.apiUrl}/api/analytics`;
const RANGE = { from: '2026-01-01', to: '2026-10-26' };

describe('AnalyticsApiService', () => {
  let service: AnalyticsApiService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AnalyticsApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AnalyticsApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('getMeta calls /meta and returns the build times', async () => {
    const promise = service.getMeta();

    const req = httpTestingController.expectOne(`${BASE}/meta`);
    expect(req.request.method).toBe('GET');
    req.flush({ sourceSnapshotAt: '2026-10-26T16:52:24Z', builtAt: '2026-10-26T16:52:29Z' });

    await expect(promise).resolves.toEqual({
      sourceSnapshotAt: '2026-10-26T16:52:24Z',
      builtAt: '2026-10-26T16:52:29Z',
    });
  });

  it('listInstruments sends the filter, sort and paging params', async () => {
    const promise = service.listInstruments({
      instrumentClass: 'EQUITY',
      sort: 'return1m',
      direction: 'desc',
      page: 0,
      size: 25,
    });

    const req = httpTestingController.expectOne((request) => request.url === `${BASE}/instruments`);
    expect(req.request.params.get('instrumentClass')).toBe('EQUITY');
    expect(req.request.params.get('sort')).toBe('return1m');
    expect(req.request.params.get('direction')).toBe('desc');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('25');
    req.flush({ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0, hasNext: false });

    await expect(promise).resolves.toMatchObject({ content: [], totalElements: 0 });
  });

  it('listInstruments sends no params when none are given', async () => {
    const promise = service.listInstruments();

    const req = httpTestingController.expectOne((request) => request.url === `${BASE}/instruments`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0, hasNext: false });

    await promise;
  });

  it('listPortfolios sends the age band and country filters', async () => {
    const promise = service.listPortfolios({
      country: ' USA ',
      ageBand: '25-34',
      sort: 'country',
    });

    const req = httpTestingController.expectOne((request) => request.url === `${BASE}/portfolios`);
    expect(req.request.params.get('country')).toBe('USA');
    expect(req.request.params.get('ageBand')).toBe('25-34');
    expect(req.request.params.get('sort')).toBe('country');
    expect(req.request.params.has('direction')).toBe(false);
    req.flush({ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0, hasNext: false });

    await promise;
  });

  it('listInstruments sends the search and segment filters', async () => {
    const promise = service.listInstruments({ search: ' app ', country: 'USA', ageBand: '<25' });

    const req = httpTestingController.expectOne((request) => request.url === `${BASE}/instruments`);
    expect(req.request.params.get('search')).toBe('app');
    expect(req.request.params.get('country')).toBe('USA');
    expect(req.request.params.get('ageBand')).toBe('<25');
    req.flush({ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0, hasNext: false });

    await promise;
  });

  it('getSummary sends the segment filter', async () => {
    const promise = service.getSummary({ ageBand: '65+' });

    const req = httpTestingController.expectOne((request) => request.url === `${BASE}/summary`);
    expect(req.request.params.get('ageBand')).toBe('65+');
    expect(req.request.params.has('country')).toBe(false);
    req.flush([]);

    await promise;
  });

  it('getSegments sends the dimension', async () => {
    const promise = service.getSegments('country');

    const req = httpTestingController.expectOne((request) => request.url === `${BASE}/segments`);
    expect(req.request.params.get('by')).toBe('country');
    req.flush([]);

    await promise;
  });

  it('getSegmentExposure sends the dimension and focus', async () => {
    const promise = service.getSegmentExposure('ageBand', { instrumentId: 'i-1' });

    const req = httpTestingController.expectOne(
      (request) => request.url === `${BASE}/segments/exposure`,
    );
    expect(req.request.params.get('by')).toBe('ageBand');
    expect(req.request.params.get('instrumentId')).toBe('i-1');
    expect(req.request.params.has('instrumentClass')).toBe(false);
    req.flush([]);

    await promise;
  });

  it('getPortfolioClassSeries sends the class and date range', async () => {
    const promise = service.getPortfolioClassSeries('p-1', 'CRYPTO', RANGE);

    const req = httpTestingController.expectOne(
      (request) => request.url === `${BASE}/portfolios/p-1/class-series`,
    );
    expect(req.request.params.get('instrumentClass')).toBe('CRYPTO');
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-10-26');
    req.flush([]);

    await promise;
  });

  it.each([
    [
      'instrument',
      (s: AnalyticsApiService) => s.getInstrumentSeries('i-1', RANGE),
      '/instruments/i-1/series',
    ],
    [
      'portfolio',
      (s: AnalyticsApiService) => s.getPortfolioSeries('p-1', RANGE),
      '/portfolios/p-1/series',
    ],
    [
      'holding',
      (s: AnalyticsApiService) => s.getHoldingSeries('h-1', RANGE),
      '/holdings/h-1/series',
    ],
  ])('get %s series sends the date range', async (_label, call, path) => {
    const promise = call(service);

    const req = httpTestingController.expectOne((request) => request.url === `${BASE}${path}`);
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-10-26');
    req.flush([]);

    await expect(promise).resolves.toEqual([]);
  });

  it.each([
    ['getSummary', (s: AnalyticsApiService) => s.getSummary(), '/summary'],
    ['getCountries', (s: AnalyticsApiService) => s.getCountries(), '/countries'],
    ['getInstrument', (s: AnalyticsApiService) => s.getInstrument('i-1'), '/instruments/i-1'],
    ['getPortfolio', (s: AnalyticsApiService) => s.getPortfolio('p-1'), '/portfolios/p-1'],
    [
      'getPortfolioHoldings',
      (s: AnalyticsApiService) => s.getPortfolioHoldings('p-1'),
      '/portfolios/p-1/holdings',
    ],
  ])('%s calls %s', async (_label, call, path) => {
    const promise = call(service);

    httpTestingController.expectOne(`${BASE}${path}`).flush({});

    await promise;
  });

  it('rejects with the HTTP error so pages can tell 503 apart from other failures', async () => {
    const promise = service.getMeta();

    httpTestingController
      .expectOne(`${BASE}/meta`)
      .flush(
        { message: 'Analytics is unavailable' },
        { status: 503, statusText: 'Service Unavailable' },
      );

    const error = await promise.catch((caught: unknown) => caught);
    expect(isAnalyticsUnavailable(error)).toBe(true);
  });
});

describe('isAnalyticsUnavailable', () => {
  it('is true only for a 503 response', () => {
    expect(isAnalyticsUnavailable(new HttpErrorResponse({ status: 503 }))).toBe(true);
    expect(isAnalyticsUnavailable(new HttpErrorResponse({ status: 500 }))).toBe(false);
    expect(isAnalyticsUnavailable(new HttpErrorResponse({ status: 403 }))).toBe(false);
    expect(isAnalyticsUnavailable(new Error('network'))).toBe(false);
  });
});
