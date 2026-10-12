import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DASHBOARD_MARKET_DATA_PORT } from '@features/dashboard/services/dashboard-market-data.port';
import {
  DASHBOARD_STATE_PORT,
  DashboardStatePort,
} from '@features/dashboard/services/dashboard-state.port';
import { DashboardWatchlistOverlayFacade } from './dashboard-watchlist-overlay.facade';

describe('DashboardWatchlistOverlayFacade', () => {
  const marketData = {
    performanceIntervals: [],
    listAssets: vi.fn(() => [
      {
        symbol: 'AAPL',
        name: 'Apple',
        instrumentType: 'stock' as const,
        basePrice: 100,
      },
    ]),
    getAsset: vi.fn((symbol: string) => {
      if (symbol === 'AAPL') {
        return {
          symbol: 'AAPL',
          name: 'Apple',
          instrumentType: 'stock' as const,
          basePrice: 100,
        };
      }

      return undefined;
    }),
    getPrice: vi.fn((symbol: string) => (symbol === 'AAPL' ? 110 : 0)),
    getPerformanceSeries: vi.fn(() => []),
    getTopWinners: vi.fn(() => []),
    getTopLosers: vi.fn(() => []),
    isKnownSymbol: vi.fn((symbol: string) => symbol === 'AAPL'),
  };

  const state: DashboardStatePort = {
    accountCash: signal(0),
    holdings: signal([]),
    orders: signal([]),
    transactions: signal([]),
    watchlists: signal([{ id: 'watchlist', name: 'Watchlist', symbols: ['VOD'] }]),
    activeWatchlistId: signal('watchlist'),
    dashboardOpenOrders: signal([]),
    returns: { allTime: 0, daily: 0 },
    watchlistConstraints: {
      minWatchlists: 1,
      maxWatchlists: 15,
      minHoldingsPerWatchlist: 0,
      maxHoldingsPerWatchlist: 40,
    },
    backendDataMode: true,
    backendWatchlistInstrumentOptions: signal([
      {
        instrumentId: 'inst-vod',
        symbol: 'VOD',
        name: 'Vodafone',
        instrumentType: 'stock' as const,
      },
      {
        instrumentId: 'inst-aapl',
        symbol: 'AAPL',
        name: 'Apple',
        instrumentType: 'stock' as const,
      },
    ]),
    load: vi.fn(async () => undefined),
    setWatchlistMembership: vi.fn(async () => undefined),
  };

  let facade: DashboardWatchlistOverlayFacade;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        DashboardWatchlistOverlayFacade,
        { provide: DASHBOARD_MARKET_DATA_PORT, useValue: marketData },
        { provide: DASHBOARD_STATE_PORT, useValue: state },
      ],
    });

    facade = TestBed.inject(DashboardWatchlistOverlayFacade);
  });

  it('shows backend watchlist asset summary for unknown market symbol with unavailable price', () => {
    facade.requestWatchlistAsset('VOD');

    expect(facade.selectedWatchlistAsset()).toEqual({
      symbol: 'VOD',
      name: 'VOD',
      price: null,
      changePct: null,
    });
  });

  it('uses backend instrument options for search rows and delegates add/remove to backend membership API', async () => {
    facade.requestAddWatchlistAsset();

    const searchRows = facade.watchlistSearchRows();
    expect(searchRows.map((row) => row.asset.symbol)).toEqual(['AAPL']);

    await facade.addSymbolToActiveWatchlist('AAPL');
    expect(state.setWatchlistMembership).toHaveBeenCalledWith('AAPL', true);

    facade.requestWatchlistAsset('VOD');
    await facade.removeSelectedWatchlistAsset();
    expect(state.setWatchlistMembership).toHaveBeenCalledWith('VOD', false);
  });
});
