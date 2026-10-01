import { Injectable, computed, inject } from '@angular/core';
import { Holding, Order } from '@core/models';
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
    this.ordersState().filter((order) => order.status === 'pending' || order.status === 'open'),
  );

  readonly historyOrders = computed(() =>
    this.ordersState().filter((order) => order.status === 'filled' || order.status === 'cancelled'),
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

  placeOrder(request: TradePlaceOrderRequest) {
    const asset = this.marketData.getAsset(request.symbol);
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

    this.ordersState.update((current) => [order, ...current]);
  }

  cancelOrder(orderId: string) {
    this.ordersState.update((current) =>
      current.map((order) =>
        order.id === orderId
          ? { ...order, status: 'cancelled' as const, cancelledAt: new Date().toISOString() }
          : order,
      ),
    );
  }

  processOrders() {
    const now = Date.now();

    for (const order of this.ordersState()) {
      if (order.status === 'pending') {
        if (now - new Date(order.createdAt).getTime() >= this.marketData.marketOrderPendingMs) {
          this.fillOrder(order.id, this.marketData.getPrice(order.symbol));
        }
      } else if (order.status === 'open' && order.limitPrice !== undefined) {
        const price = this.marketData.getPrice(order.symbol);
        const crossed = order.type === 'buy' ? price <= order.limitPrice : price >= order.limitPrice;
        if (crossed) {
          this.fillOrder(order.id, order.limitPrice);
        }
      }
    }
  }

  private fillOrder(orderId: string, fillPrice: number) {
    const order = this.ordersState().find((entry) => entry.id === orderId);
    if (!order) {
      return;
    }

    this.ordersState.update((current) =>
      current.map((entry) =>
        entry.id === orderId
          ? {
              ...entry,
              status: 'filled' as const,
              fillPrice,
              filledAt: new Date().toISOString(),
            }
          : entry,
      ),
    );

    const cost = fillPrice * order.quantity;

    this.accountCashState.update((cash) => (order.type === 'buy' ? cash - cost : cash + cost));

    this.holdingsState.update((current) => this.reconcileHoldings(current, order));
  }

  private reconcileHoldings(current: Holding[], order: Order): Holding[] {
    const existing = current.find((holding) => holding.symbol === order.symbol);

    if (order.type === 'buy') {
      if (existing) {
        return current.map((holding) =>
          holding.symbol === order.symbol
            ? { ...holding, quantity: holding.quantity + order.quantity }
            : holding,
        );
      }

      return [
        ...current,
        {
          symbol: order.symbol,
          instrumentType: order.instrumentType,
          quantity: order.quantity,
        },
      ];
    }

    if (!existing) {
      return current;
    }

    const remaining = existing.quantity - order.quantity;
    if (remaining <= 0) {
      return current.filter((holding) => holding.symbol !== order.symbol);
    }

    return current.map((holding) =>
      holding.symbol === order.symbol ? { ...holding, quantity: remaining } : holding,
    );
  }
}
