import { Injectable, computed, inject } from '@angular/core';
import { isActiveOrderStatus } from '@core/constants/order-status.constants';
import { Order } from '@core/models';
import { TRADE_MARKET_DATA_PORT } from './trade-market-data.port';
import { TRADE_STATE_PORT } from './trade-state.port';

export interface TradePlaceOrderRequest {
  symbol: string;
  kind: Order['kind'];
  type: Order['type'];
  quantity: number;
  limitPrice?: number;
}

@Injectable({
  providedIn: 'root',
})
export class TradeOrderEngineService {
  private readonly marketData = inject(TRADE_MARKET_DATA_PORT);
  private readonly state = inject(TRADE_STATE_PORT);

  private readonly accountCashState = this.state.accountCash;
  private readonly holdingsState = this.state.holdings;
  private readonly ordersState = this.state.orders;

  readonly accountCash = this.accountCashState.asReadonly();
  readonly holdings = this.holdingsState.asReadonly();
  readonly orders = this.ordersState.asReadonly();

  readonly openOrders = computed(() =>
    this.ordersState().filter((order) => isActiveOrderStatus(order.status)),
  );

  readonly historyOrders = computed(() =>
    this.ordersState().filter((order) => !isActiveOrderStatus(order.status)),
  );

  isKnownAssetSymbol(symbol: string): boolean {
    return this.marketData.isKnownSymbol(symbol);
  }

  getOrderById(orderId: string | null): Order | null {
    if (!orderId) {
      return null;
    }

    return this.ordersState().find((order) => order.id === orderId) ?? null;
  }

  getOwnedQuantity(symbol: string | null): number {
    if (!symbol) {
      return 0;
    }

    return this.holdingsState().find((holding) => holding.symbol === symbol)?.quantity ?? 0;
  }

  async placeOrder(request: TradePlaceOrderRequest) {
    if (!this.state.submitOrder) {
      throw new Error('Order placement is unavailable.');
    }

    await this.state.submitOrder(request);
  }

  async cancelOrder(orderId: string) {
    if (!this.state.cancelOrder) {
      throw new Error('Order cancellation is unavailable.');
    }

    await this.state.cancelOrder(orderId);
  }
}
