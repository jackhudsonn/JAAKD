import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { TradeCardComponent } from './cards/trade-card/trade-card.component';
import { HoldingsCardComponent } from './cards/holdings-card/holdings-card.component';
import { OrdersCardComponent } from './cards/orders-card/orders-card.component';
import { WatchlistCardComponent } from './cards/watchlist-card/watchlist-card.component';
import {
  AssetPopupComponent,
  AssetOrderPlaced,
} from './components/asset-popup/asset-popup.component';
import { OrderDetailsPopupComponent } from './components/order-details-popup/order-details-popup.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { startCycleTimer } from '../../shared/utils/cycle-timer';
import { Holding, Order } from '../../core/models';
import {
  MARKET_ORDER_PENDING_MS,
  MOCK_ACCOUNT_CASH,
  MOCK_ASSETS,
  MOCK_HOLDINGS,
  MOCK_OPEN_ORDERS,
  MOCK_ORDER_HISTORY,
  MOCK_WATCHLIST_SYMBOLS,
  getMockPrice,
} from './mock-data';

interface TradeWatchlist {
  id: string;
  name: string;
  symbols: string[];
}

@Component({
  selector: 'app-trade',
  standalone: true,
  imports: [
    TradeCardComponent,
    HoldingsCardComponent,
    OrdersCardComponent,
    WatchlistCardComponent,
    AssetPopupComponent,
    OrderDetailsPopupComponent,
    ModalComponent,
  ],
  templateUrl: './trade.component.html',
  styleUrl: './trade.component.css',
})
export class TradeComponent implements OnInit, OnDestroy {
  // TODO: replace with AccountService.getCash() / PortfolioService.getHoldings() /
  // OrdersService.getOpenOrders()+getHistory() / a saved watchlist endpoint.
  accountCash = signal(MOCK_ACCOUNT_CASH);
  holdings = signal<Holding[]>([...MOCK_HOLDINGS]);
  orders = signal<Order[]>([...MOCK_OPEN_ORDERS, ...MOCK_ORDER_HISTORY]);
  watchlists = signal<TradeWatchlist[]>([
    { id: 'recommendations', name: 'Recommendations', symbols: [...MOCK_WATCHLIST_SYMBOLS] },
    { id: 'save-for-later', name: 'Save for Later', symbols: ['IONQ', 'IBM', 'BTC'] },
  ]);
  activeWatchlistId = signal('recommendations');
  watchlistSymbols = computed(() => {
    const active = this.watchlists().find((watchlist) => watchlist.id === this.activeWatchlistId());
    return active?.symbols ?? [];
  });
  watchlistOptions = computed(() =>
    this.watchlists().map((watchlist) => ({ id: watchlist.id, name: watchlist.name })),
  );
  activeWatchlist = computed(
    () => this.watchlists().find((watchlist) => watchlist.id === this.activeWatchlistId()) ?? null,
  );
  watchlistDialogMode = signal<'create' | 'delete' | null>(null);
  watchlistNameDraft = signal('');
  watchlistDialogError = signal<string | null>(null);

  // Non-blocking banner for failed data loads. Currently unused since mock
  // data can't fail to load — wire this up once the signals above are
  // populated from real HTTP calls that can reject.
  loadError = signal<string | null>(null);

  openOrders = computed(() =>
    this.orders().filter((order) => order.status === 'pending' || order.status === 'open'),
  );
  historyOrders = computed(() =>
    this.orders().filter((order) => order.status === 'filled' || order.status === 'cancelled'),
  );

  // Only one popup is ever open at a time.
  activeAssetSymbol = signal<string | null>(null);
  activeAssetShowChart = signal(false);
  activeOrderId = signal<string | null>(null);

  activeOrder = computed(
    () => this.orders().find((order) => order.id === this.activeOrderId()) ?? null,
  );
  activeAssetOwnedQuantity = computed(
    () =>
      this.holdings().find((holding) => holding.symbol === this.activeAssetSymbol())?.quantity ?? 0,
  );

  private stopTicking?: () => void;

  ngOnInit() {
    this.stopTicking = startCycleTimer(1, 1000, () => this.processOrders());
  }

  ngOnDestroy() {
    this.stopTicking?.();
  }

  dismissError() {
    this.loadError.set(null);
  }

  setActiveWatchlist(watchlistId: string) {
    if (!this.watchlists().some((watchlist) => watchlist.id === watchlistId)) {
      return;
    }
    this.activeWatchlistId.set(watchlistId);
  }

  createWatchlist() {
    this.watchlistNameDraft.set('');
    this.watchlistDialogError.set(null);
    this.watchlistDialogMode.set('create');
  }

  deleteActiveWatchlist() {
    if (this.watchlists().length <= 1) {
      return;
    }

    this.watchlistDialogError.set(null);
    this.watchlistDialogMode.set('delete');
  }

  closeWatchlistDialog() {
    this.watchlistDialogMode.set(null);
    this.watchlistNameDraft.set('');
    this.watchlistDialogError.set(null);
  }

  onWatchlistNameInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.watchlistNameDraft.set(target.value);
    if (this.watchlistDialogError()) {
      this.watchlistDialogError.set(null);
    }
  }

  saveWatchlistName() {
    const mode = this.watchlistDialogMode();
    if (mode !== 'create') {
      return;
    }

    const trimmedName = this.watchlistNameDraft().trim();
    if (!trimmedName) {
      this.watchlistDialogError.set('Watchlist name is required.');
      return;
    }

    if (this.isWatchlistNameTaken(trimmedName)) {
      this.watchlistDialogError.set('A watchlist with that name already exists.');
      return;
    }

    const baseId = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const idSeed = baseId || 'watchlist';
    const id = `${idSeed}-${Date.now()}`;

    this.watchlists.update((current) => [...current, { id, name: trimmedName, symbols: [] }]);
    this.activeWatchlistId.set(id);
    this.closeWatchlistDialog();
  }

  confirmDeleteWatchlist() {
    const currentWatchlists = this.watchlists();
    if (currentWatchlists.length <= 1) {
      return;
    }

    const activeId = this.activeWatchlistId();
    const activeIndex = currentWatchlists.findIndex((watchlist) => watchlist.id === activeId);
    if (activeIndex < 0) {
      return;
    }

    const nextActive =
      currentWatchlists[activeIndex + 1] ??
      currentWatchlists[activeIndex - 1] ??
      currentWatchlists[0];

    this.watchlists.set(currentWatchlists.filter((watchlist) => watchlist.id !== activeId));
    this.activeWatchlistId.set(nextActive.id);
    this.closeWatchlistDialog();
  }

  private isWatchlistNameTaken(name: string) {
    const normalizedName = name.trim().toLowerCase();
    return this.watchlists().some(
      (watchlist) => watchlist.name.trim().toLowerCase() === normalizedName,
    );
  }

  openAsset(symbol: string, showChart = false) {
    this.activeAssetSymbol.set(symbol);
    this.activeAssetShowChart.set(showChart);
  }

  closeAssetPopup() {
    this.activeAssetSymbol.set(null);
  }

  openOrderDetails(orderId: string) {
    this.activeOrderId.set(orderId);
  }

  closeOrderPopup() {
    this.activeOrderId.set(null);
  }

  placeOrder(request: AssetOrderPlaced) {
    // TODO: call OrdersService.place(...) and reconcile with the server
    // response instead of creating + simulating fills locally.
    const asset = MOCK_ASSETS.find((a) => a.symbol === request.symbol);
    if (!asset) {
      return;
    }

    const order: Order = {
      id: `ord-${Date.now()}`,
      symbol: request.symbol,
      instrumentType: asset.instrumentType,
      kind: request.kind,
      type: request.type,
      quantity: request.quantity,
      limitPrice: request.limitPrice,
      status: request.kind === 'market' ? 'pending' : 'open',
      createdAt: new Date().toISOString(),
    };

    this.orders.update((current) => [order, ...current]);
  }

  cancelOrder(orderId: string) {
    // TODO: call OrdersService.cancel(orderId).
    this.orders.update((current) =>
      current.map((order) =>
        order.id === orderId
          ? { ...order, status: 'cancelled' as const, cancelledAt: new Date().toISOString() }
          : order,
      ),
    );
    this.closeOrderPopup();
  }

  private processOrders() {
    const now = Date.now();

    for (const order of this.orders()) {
      if (order.status === 'pending') {
        if (now - new Date(order.createdAt).getTime() >= MARKET_ORDER_PENDING_MS) {
          this.fillOrder(order.id, getMockPrice(order.symbol));
        }
      } else if (order.status === 'open' && order.limitPrice !== undefined) {
        const price = getMockPrice(order.symbol);
        const crossed =
          order.type === 'buy' ? price <= order.limitPrice : price >= order.limitPrice;
        if (crossed) {
          this.fillOrder(order.id, order.limitPrice);
        }
      }
    }
  }

  private fillOrder(orderId: string, fillPrice: number) {
    const order = this.orders().find((o) => o.id === orderId);
    if (!order) {
      return;
    }

    this.orders.update((current) =>
      current.map((o) =>
        o.id === orderId
          ? { ...o, status: 'filled' as const, fillPrice, filledAt: new Date().toISOString() }
          : o,
      ),
    );

    const cost = fillPrice * order.quantity;

    // TODO: replace with a real balance update via AccountService once
    // orders settle against an actual bank/brokerage balance. Note: since
    // cash/holdings are only adjusted at fill time (not at placement), the
    // mock data doesn't reserve funds/shares across multiple pending orders.
    this.accountCash.update((cash) => (order.type === 'buy' ? cash - cost : cash + cost));

    this.holdings.update((current) => {
      const existing = current.find((h) => h.symbol === order.symbol);

      if (order.type === 'buy') {
        if (existing) {
          return current.map((h) =>
            h.symbol === order.symbol ? { ...h, quantity: h.quantity + order.quantity } : h,
          );
        }
        return [
          ...current,
          { symbol: order.symbol, instrumentType: order.instrumentType, quantity: order.quantity },
        ];
      }

      if (!existing) {
        return current;
      }

      const remaining = existing.quantity - order.quantity;
      if (remaining <= 0) {
        return current.filter((h) => h.symbol !== order.symbol);
      }
      return current.map((h) => (h.symbol === order.symbol ? { ...h, quantity: remaining } : h));
    });
  }
}
