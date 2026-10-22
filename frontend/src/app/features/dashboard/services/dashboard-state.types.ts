export interface SharedWatchlist {
  id: string;
  name: string;
  symbols: string[];
}

export interface DashboardOpenOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: 'pending' | 'partially_filled';
}

export interface DashboardReturns {
  allTime: number;
  daily: number;
}

export interface DashboardWatchlistConstraints {
  minWatchlists: number;
  maxWatchlists: number;
  minHoldingsPerWatchlist: number;
  maxHoldingsPerWatchlist: number | null;
}

export const DASHBOARD_RETURNS_BASE: DashboardReturns = {
  allTime: 0,
  daily: 0,
};

export const DASHBOARD_WATCHLIST_CONSTRAINTS: DashboardWatchlistConstraints = {
  minWatchlists: 0,
  maxWatchlists: 15,
  minHoldingsPerWatchlist: 0,
  maxHoldingsPerWatchlist: null,
};
