import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ORDER_STATUS } from '@core/constants/order-status.constants';
import { ActivatedRoute, Router } from '@angular/router';
import { CASH_CURRENCIES } from '@core/models/api.models';
import { Subscription } from 'rxjs';
import { TradeCardComponent } from './cards/trade/trade-card.component';
import { HoldingsCardComponent } from './cards/holdings/holdings-card.component';
import { TradeHistoryComponent } from './cards/trade-history/trade-history.component';
import {
  AssetPopupComponent,
  AssetOrderPlaced,
  AssetSetWatchlistMembershipRequest,
} from './components/asset-popup/asset-popup.component';
import { OrderDetailsPopupComponent } from './components/order-details-popup/order-details-popup.component';
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
    TradeDeepLinkService,
    TradeOrderEngineService,
    TradeWatchlistService,
    { provide: TRADE_STATE_PORT, useExisting: BackendTradeStateService },
    { provide: TRADE_MARKET_DATA_PORT, useExisting: BackendTradeMarketDataService },
  ],
  imports: [
    TradeCardComponent,
    HoldingsCardComponent,
    TradeHistoryComponent,
    AssetPopupComponent,
    OrderDetailsPopupComponent,
  ],
  templateUrl: './trade.component.html',
  styleUrl: './trade.component.css',
})
export class TradeComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tradeFacade = inject(TradeFacadeService);
  private readonly tradeDeepLinkService = inject(TradeDeepLinkService);
  private readonly toastService = inject(ToastService);

  accountCash = this.tradeFacade.accountCash;
  holdings = this.tradeFacade.holdings;
  orders = this.tradeFacade.orders;
  readonly cashBalances = computed(() => {
    const balances = this.tradeFacade.cashBalances();
    if (!balances) {
      return null;
    }

    return Object.entries(balances).flatMap(([currency, amount]) => {
      const supportedCurrency = CASH_CURRENCIES.find((entry) => entry === currency);
      return supportedCurrency ? [{ currency: supportedCurrency, amount }] : [];
    });
  });
  readonly maxWatchlistHoldings = this.tradeFacade.maxWatchlistHoldings;

  readonly backendDataMode = this.tradeFacade.backendDataMode;
  readonly loadState = computed(() => this.tradeFacade.loadState?.() ?? 'ready');

  // Only one popup is ever open at a time.
  activeAssetSymbol = signal<string | null>(null);
  activeOrderId = signal<string | null>(null);
  private readonly requestedOrderId = signal<string | null>(null);

  activeOrder = computed(() => this.tradeFacade.getOrderById(this.activeOrderId()));
  activeOrderHistory = computed(() => this.tradeFacade.getOrderHistory(this.activeOrderId()));
  activeAssetOwnedQuantity = computed(() =>
    this.tradeFacade.getOwnedQuantity(this.activeAssetSymbol()),
  );
  watchlistOptionsForActiveAsset = computed(() =>
    this.tradeFacade.getWatchlistOptionsForSymbol(this.activeAssetSymbol()),
  );

  private routeQuerySubscription?: Subscription;
  private orderQuerySubscription?: Subscription;
  private readonly previousOrderStatuses = new Map<string, OrderStatus>();
  private seededOrderStatusTracking = false;

  constructor() {
    effect(() => {
      const orderId = this.requestedOrderId();
      if (!orderId || (this.backendDataMode && this.loadState() !== 'ready')) {
        return;
      }

      if (!this.tradeFacade.getOrderById(orderId)) {
        return;
      }

      this.activeOrderId.set(orderId);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { orderId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

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
        const transitionedToRejected =
          (order.status === ORDER_STATUS.REJECTED || order.status === ORDER_STATUS.FAILED) &&
          previousStatus !== order.status;

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
    this.routeQuerySubscription = this.tradeDeepLinkService.subscribeToSymbolQueryParam(
      this.route,
      (symbol) => this.openAsset(symbol),
    );
    this.orderQuerySubscription = this.route.queryParamMap.subscribe((queryParams) => {
      this.requestedOrderId.set(queryParams.get('orderId'));
    });
  }

  ngOnDestroy() {
    this.routeQuerySubscription?.unsubscribe();
    this.orderQuerySubscription?.unsubscribe();
  }

  openAsset(symbol: string) {
    this.activeAssetSymbol.set(symbol);
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

  async placeOrder(request: AssetOrderPlaced) {
    try {
      await this.tradeFacade.placeOrder(request);
      this.toastService.success(
        `${request.type === 'buy' ? 'Buy' : 'Sell'} order placed for ${request.quantity} ${request.symbol} at market.`,
      );
    } catch (error) {
      this.toastService.error(this.toActionErrorMessage(error, 'The order could not be placed.'));
    }
  }

  async setWatchlistMembership(request: AssetSetWatchlistMembershipRequest) {
    try {
      await this.tradeFacade.setWatchlistMembership(request);
    } catch (error) {
      this.toastService.error(
        this.toActionErrorMessage(error, 'The watchlist could not be updated.'),
      );
    }
  }

  async cancelOrder(orderId: string) {
    try {
      await this.tradeFacade.cancelOrder(orderId);
      this.closeOrderPopup();
    } catch (error) {
      this.toastService.error(
        this.toActionErrorMessage(error, 'The order could not be cancelled.'),
      );
    }
  }

  retryLoad() {
    void this.tradeFacade.load();
  }

  private toActionErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.trim() ? error.message : fallback;
  }
}
