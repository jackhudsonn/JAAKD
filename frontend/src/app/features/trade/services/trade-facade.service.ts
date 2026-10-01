import { Injectable, inject } from '@angular/core';
import { Order } from '@core/models';
import {
  TradeOrderEngineService,
  TradePlaceOrderRequest,
} from './trade-order-engine.service';
import {
  TradeSetWatchlistMembershipRequest,
  TradeWatchlistOption,
  TradeWatchlistService,
} from './trade-watchlist.service';

export type PlaceOrderRequest = TradePlaceOrderRequest;
export type SetWatchlistMembershipRequest = TradeSetWatchlistMembershipRequest;
export type { TradeWatchlistOption };

@Injectable({
  providedIn: 'root',
})
export class TradeFacadeService {
  private readonly orderEngine = inject(TradeOrderEngineService);
  private readonly watchlistService = inject(TradeWatchlistService);

  readonly accountCash = this.orderEngine.accountCash;
  readonly holdings = this.orderEngine.holdings;
  readonly orders = this.orderEngine.orders;

  readonly maxWatchlistHoldings = this.watchlistService.maxWatchlistHoldings;

  readonly openOrders = this.orderEngine.openOrders;
  readonly historyOrders = this.orderEngine.historyOrders;

  isKnownAssetSymbol(symbol: string): boolean {
    return this.orderEngine.isKnownAssetSymbol(symbol);
  }

  getOrderById(orderId: string | null): Order | null {
    return this.orderEngine.getOrderById(orderId);
  }

  getOwnedQuantity(symbol: string | null): number {
    return this.orderEngine.getOwnedQuantity(symbol);
  }

  getWatchlistOptionsForSymbol(symbol: string | null): TradeWatchlistOption[] {
    return this.watchlistService.getWatchlistOptionsForSymbol(symbol);
  }

  placeOrder(request: PlaceOrderRequest) {
    this.orderEngine.placeOrder(request);
  }

  setWatchlistMembership(request: SetWatchlistMembershipRequest) {
    this.watchlistService.setWatchlistMembership(request);
  }

  cancelOrder(orderId: string) {
    this.orderEngine.cancelOrder(orderId);
  }

  processOrders() {
    this.orderEngine.processOrders();
  }
}
