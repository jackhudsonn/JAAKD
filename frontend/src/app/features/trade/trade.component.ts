import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { TradeCardComponent } from './cards/trade/trade-card.component';
import { HoldingsCardComponent } from './cards/holdings/holdings-card.component';
import { OrdersCardComponent } from './cards/orders/orders-card.component';
import {
  AssetPopupComponent,
  AssetOrderPlaced,
  AssetSetWatchlistMembershipRequest,
} from './components/asset-popup/asset-popup.component';
import { OrderDetailsPopupComponent } from './components/order-details-popup/order-details-popup.component';
import { startCycleTimer } from '@shared/utils/cycle-timer';
import { TradeFacadeService } from '@features/trade/services/trade-facade.service';
import { TradeDeepLinkService } from '@features/trade/services/trade-deep-link.service';
import { TRADE_MARKET_DATA_PORT } from './services/trade-market-data.port';
import { TRADE_STATE_PORT } from './services/trade-state.port';
import { BackendTradeStateService } from './services/backend-trade-state.service';
import { BackendTradeMarketDataService } from './services/backend-trade-market-data.service';
import { TradeOrderEngineService } from './services/trade-order-engine.service';
import { TradeWatchlistService } from './services/trade-watchlist.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { OrderStatus } from '@core/models';

@Component({
  selector: 'app-trade',
  standalone: true,
  providers: [
    BackendTradeStateService,
    BackendTradeMarketDataService,
    TradeFacadeService,
    TradeOrderEngineService,
    TradeWatchlistService,
    { provide: TRADE_STATE_PORT, useExisting: BackendTradeStateService },
    { provide: TRADE_MARKET_DATA_PORT, useExisting: BackendTradeMarketDataService },
  ],
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
  private readonly route = inject(ActivatedRoute);
  private readonly tradeFacade = inject(TradeFacadeService);
  private readonly tradeDeepLinkService = inject(TradeDeepLinkService);
  private readonly toastService = inject(ToastService);

  holdings = this.tradeFacade.holdings;
  orders = this.tradeFacade.orders;
  readonly cashBalances = computed(() => {
    const balances = this.tradeFacade.cashBalances();
    if (!balances) {
      return [];
    }

    return Object.entries(balances).map(([currency, amount]) => ({ currency, amount }));
  });
  readonly availableBuyCash = computed(() => this.tradeFacade.cashBalances()?.['USD'] ?? 0);
  readonly maxWatchlistHoldings = this.tradeFacade.maxWatchlistHoldings;

  openOrders = this.tradeFacade.openOrders;
  historyOrders = this.tradeFacade.historyOrders;
  readonly backendDataMode = this.tradeFacade.backendDataMode;
  readonly loadState = computed(() => this.tradeFacade.loadState?.() ?? 'ready');

  // Only one popup is ever open at a time.
  activeAssetSymbol = signal<string | null>(null);
  activeAssetShowChart = signal(false);
  activeOrderId = signal<string | null>(null);

  activeOrder = computed(() => this.tradeFacade.getOrderById(this.activeOrderId()));
  activeAssetOwnedQuantity = computed(() =>
    this.tradeFacade.getOwnedQuantity(this.activeAssetSymbol()),
  );
  watchlistOptionsForActiveAsset = computed(() =>
    this.tradeFacade.getWatchlistOptionsForSymbol(this.activeAssetSymbol()),
  );

  private stopTicking?: () => void;
  private routeQuerySubscription?: Subscription;
  private readonly previousOrderStatuses = new Map<string, OrderStatus>();
  private seededOrderStatusTracking = false;

  constructor() {
    effect(() => {
      const currentOrders = this.orders();
      const currentLoadState = this.loadState();

      if (!this.seededOrderStatusTracking) {
        if (this.backendDataMode && currentLoadState !== 'ready') {
          return;
        }

        for (const order of currentOrders) {
          this.previousOrderStatuses.set(order.id, order.status);
        }

        this.seededOrderStatusTracking = true;
        return;
      }

      if (this.backendDataMode && currentLoadState !== 'ready') {
        return;
      }

      const activeOrderIds = new Set<string>();

      for (const order of currentOrders) {
        activeOrderIds.add(order.id);

        const previousStatus = this.previousOrderStatuses.get(order.id);
        const transitionedToRejected = order.status === 'rejected' && previousStatus !== 'rejected';

        if (transitionedToRejected) {
          const reason = order.statusReason?.trim();
          this.toastService.error(
            reason
              ? `${order.symbol} ${order.type} order was rejected: ${reason}`
              : `${order.symbol} ${order.type} order was rejected.`,
          );
        }

        this.previousOrderStatuses.set(order.id, order.status);
      }

      for (const knownOrderId of [...this.previousOrderStatuses.keys()]) {
        if (!activeOrderIds.has(knownOrderId)) {
          this.previousOrderStatuses.delete(knownOrderId);
        }
      }
    });
  }

  ngOnInit() {
    void this.tradeFacade.load();
    this.stopTicking = startCycleTimer(1, 1000, () => this.tradeFacade.processOrders());
    this.routeQuerySubscription = this.tradeDeepLinkService.subscribeToSymbolQueryParam(
      this.route,
      (symbol) => this.openAsset(symbol, false),
    );
  }

  ngOnDestroy() {
    this.stopTicking?.();
    this.routeQuerySubscription?.unsubscribe();
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
    void this.tradeFacade.placeOrder(request);
  }

  setWatchlistMembership(request: AssetSetWatchlistMembershipRequest) {
    void this.tradeFacade.setWatchlistMembership(request);
  }

  cancelOrder(orderId: string) {
    void this.tradeFacade.cancelOrder(orderId);
    this.closeOrderPopup();
  }

  retryLoad() {
    void this.tradeFacade.load();
  }
}
