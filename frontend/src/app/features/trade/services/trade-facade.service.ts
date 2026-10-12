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
import { TRADE_STATE_PORT } from './trade-state.port';

export type PlaceOrderRequest = TradePlaceOrderRequest;
export type SetWatchlistMembershipRequest = TradeSetWatchlistMembershipRequest;
export type { TradeWatchlistOption };

@Injectable({
  providedIn: 'root',
})
export class TradeFacadeService {
  private readonly orderEngine = inject(TradeOrderEngineService);
  private readonly watchlistService = inject(TradeWatchlistService);
  private readonly state = inject(TRADE_STATE_PORT);

  readonly accountCash = this.orderEngine.accountCash;
  readonly holdings = this.orderEngine.holdings;
  readonly orders = this.orderEngine.orders;

  readonly maxWatchlistHoldings = this.watchlistService.maxWatchlistHoldings;
  readonly backendDataMode = this.state.backendDataMode ?? false;
  readonly loadState = this.state.loadState;

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

  async load() {
    await this.state.load?.();
  }

  placeOrder(request: PlaceOrderRequest) {
    return this.orderEngine.placeOrder(request);
  }

  setWatchlistMembership(request: SetWatchlistMembershipRequest) {
    return this.watchlistService.setWatchlistMembership(request);
  }

  cancelOrder(orderId: string) {
    return this.orderEngine.cancelOrder(orderId);
  }

  processOrders() {
    this.orderEngine.processOrders();
  }
}
