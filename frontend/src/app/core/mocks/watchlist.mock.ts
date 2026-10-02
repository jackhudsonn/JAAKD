// CONTRACT_DIFF: The frontend watchlist model intentionally supports multiple named
// watchlists with a variable number of symbols per watchlist.
// Backend currently exposes watchlist records at the item level, so backend schema/API
// updates are expected to align with this nested watchlist UX model.

export interface SharedWatchlist {
  id: string;
  name: string;
  symbols: string[];
}

// TODO: Replace these client-side watchlist boundaries with backend-provided limits.
export const WATCHLIST_CONSTRAINTS = {
  minWatchlists: 1,
  maxWatchlists: 15,
  minHoldingsPerWatchlist: 0,
  maxHoldingsPerWatchlist: 40,
} as const;

export const DEFAULT_ACTIVE_WATCHLIST_ID = 'my-watchlist';

export const MOCK_WATCHLISTS: SharedWatchlist[] = [
  {
    id: DEFAULT_ACTIVE_WATCHLIST_ID,
    name: 'My Watchlist',
    symbols: [],
  },
];
