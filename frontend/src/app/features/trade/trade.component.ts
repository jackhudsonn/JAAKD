import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { TradeCardComponent } from './cards/trade-card/trade-card.component';
import { HoldingsCardComponent } from './cards/holdings-card/holdings-card.component';
import { OrdersCardComponent } from './cards/orders-card/orders-card.component';
import {
  AssetPopupComponent,
  AssetOrderPlaced,
  AssetSetWatchlistMembershipRequest,
} from './components/asset-popup/asset-popup.component';
import { OrderDetailsPopupComponent } from './components/order-details-popup/order-details-popup.component';
import { startCycleTimer } from '@shared/utils/cycle-timer';
import { TradeFacadeService } from './services/trade-facade.service';
import { TradeDeepLinkService } from './services/trade-deep-link.service';

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
  private readonly route = inject(ActivatedRoute);
  private readonly tradeFacade = inject(TradeFacadeService);
  private readonly tradeDeepLinkService = inject(TradeDeepLinkService);

  accountCash = this.tradeFacade.accountCash;
  holdings = this.tradeFacade.holdings;
  orders = this.tradeFacade.orders;
  readonly maxWatchlistHoldings = this.tradeFacade.maxWatchlistHoldings;

  openOrders = this.tradeFacade.openOrders;
  historyOrders = this.tradeFacade.historyOrders;

  // Only one popup is ever open at a time.
  activeAssetSymbol = signal<string | null>(null);
  activeAssetShowChart = signal(false);
  activeOrderId = signal<string | null>(null);

  activeOrder = computed(() => this.tradeFacade.getOrderById(this.activeOrderId()));
  activeAssetOwnedQuantity = computed(
    () => this.tradeFacade.getOwnedQuantity(this.activeAssetSymbol()),
  );
  watchlistOptionsForActiveAsset = computed(() =>
    this.tradeFacade.getWatchlistOptionsForSymbol(this.activeAssetSymbol()),
  );

  private stopTicking?: () => void;
  private routeQuerySubscription?: Subscription;

  ngOnInit() {
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
    this.tradeFacade.placeOrder(request);
  }

  setWatchlistMembership(request: AssetSetWatchlistMembershipRequest) {
    this.tradeFacade.setWatchlistMembership(request);
  }

  cancelOrder(orderId: string) {
    this.tradeFacade.cancelOrder(orderId);
    this.closeOrderPopup();
  }
}
