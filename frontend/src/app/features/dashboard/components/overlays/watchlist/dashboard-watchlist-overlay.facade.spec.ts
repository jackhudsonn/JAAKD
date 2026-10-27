import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  DASHBOARD_STATE_PORT,
  DashboardStatePort,
} from '@features/dashboard/services/dashboard-state.port';
import { ToastService } from '@shared/components/toast/toast.service';
import { DashboardWatchlistOverlayFacade } from './dashboard-watchlist-overlay.facade';

describe('DashboardWatchlistOverlayFacade', () => {
  const state: DashboardStatePort = {
    accountCash: signal(0),
    holdings: signal([]),
    orders: signal([]),
    transactions: signal([]),
    watchlists: signal([{ id: 'watchlist', name: 'Watchlist', symbols: ['VOD'] }]),
    activeWatchlistId: signal('watchlist'),
    watchlistConstraints: {
      minWatchlists: 0,
      maxWatchlists: 15,
      minHoldingsPerWatchlist: 0,
      maxHoldingsPerWatchlist: null,
    },
    backendWatchlistInstrumentOptions: signal([
      {
        instrumentId: 'inst-vod',
        symbol: 'VOD',
        name: 'Vodafone',
        currency: 'GBP',
        instrumentType: 'equity' as const,
      },
      {
        instrumentId: 'inst-aapl',
        symbol: 'AAPL',
        name: 'Apple',
        currency: 'USD',
        instrumentType: 'equity' as const,
      },
    ]),
    load: vi.fn(async () => undefined),
    setWatchlistMembership: vi.fn(async () => undefined),
    createWatchlist: vi.fn(async () => undefined),
    renameWatchlist: vi.fn(async () => undefined),
    deleteWatchlist: vi.fn(async () => undefined),
  };

  let facade: DashboardWatchlistOverlayFacade;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        DashboardWatchlistOverlayFacade,
        { provide: DASHBOARD_STATE_PORT, useValue: state },
      ],
    });

    facade = TestBed.inject(DashboardWatchlistOverlayFacade);
  });

  it('shows backend watchlist asset summary for unknown market symbol with unavailable price', () => {
    facade.requestWatchlistAsset('VOD');

    expect(facade.selectedWatchlistAsset()).toEqual({
      symbol: 'VOD',
      name: 'Vodafone',
      currency: 'GBP',
      price: null,
      changePct: null,
    });
  });

  it('uses backend instrument options for search rows and delegates add/remove to backend membership API', async () => {
    facade.requestAddWatchlistAsset();

    const searchRows = facade.watchlistSearchRows();
    expect(searchRows.map((row) => row.asset.symbol)).toEqual(['AAPL']);

    await facade.addSymbolToActiveWatchlist('AAPL');
    expect(state.setWatchlistMembership).toHaveBeenCalledWith('AAPL', 'watchlist', true);

    facade.requestWatchlistAsset('VOD');
    await facade.removeSelectedWatchlistAsset();
    expect(state.setWatchlistMembership).toHaveBeenCalledWith('VOD', 'watchlist', false);
  });

  it('shows the backend validation message when an instrument cannot be added', async () => {
    const message = 'Only equities, ETFs, and crypto instruments can be added to a watchlist.';
    const toastService = TestBed.inject(ToastService);
    const errorToast = vi.spyOn(toastService, 'error');
    vi.mocked(state.setWatchlistMembership!).mockRejectedValueOnce({ error: { message } });

    await facade.addSymbolToActiveWatchlist('USD');

    expect(errorToast).toHaveBeenCalledWith(message);
  });
});
