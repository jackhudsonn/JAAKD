import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TradeCardComponent } from './cards/trade-card/trade-card.component';
import { HoldingsCardComponent } from './cards/holdings-card/holdings-card.component';
import { OrdersCardComponent } from './cards/orders-card/orders-card.component';
import {
  AssetPopupComponent,
  AssetOrderPlaced,
} from './components/asset-popup/asset-popup.component';
import { OrderDetailsPopupComponent } from './components/order-details-popup/order-details-popup.component';
import { startCycleTimer } from '../../shared/utils/cycle-timer';
import { Order } from '../../core/models';
import {
  MARKET_ORDER_PENDING_MS,
  MOCK_STATE,
  MOCK_ASSETS,
  getMockPrice,
} from '../../core/mocks/mock-data';

@Component({
  selector: 'app-trade',
  standalone: true,
  imports: [
    TradeCardComponent,
    HoldingsCardComponent,
    OrdersCardComponent,
    AssetPopupComponent,
    OrderDetailsPopupComponent,
  ],
  templateUrl: './trade.component.html',
  styleUrl: './trade.component.css',
})
export class TradeComponent implements OnInit, OnDestroy {
  // TODO: replace with AccountService.getCash() / PortfolioService.getHoldings() /
  // OrdersService.getOpenOrders()+getHistory().
  accountCash = MOCK_STATE.accountCash;
  holdings = MOCK_STATE.holdings;
  orders = MOCK_STATE.orders;

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
  private routeQuerySubscription?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    this.stopTicking = startCycleTimer(1, 1000, () => this.processOrders());

    this.routeQuerySubscription = this.route.queryParamMap.subscribe((queryParams) => {
      const rawSymbol = queryParams.get('symbol');
      if (!rawSymbol) {
        return;
      }

      const symbol = rawSymbol.trim().toUpperCase();
      if (!MOCK_ASSETS.some((asset) => asset.symbol === symbol)) {
        return;
      }

      this.openAsset(symbol, false);

      // Consume the deep-link param so refresh/back doesn't reopen unexpectedly.
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { symbol: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  ngOnDestroy() {
    this.stopTicking?.();
    this.routeQuerySubscription?.unsubscribe();
  }

  dismissError() {
    this.loadError.set(null);
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
