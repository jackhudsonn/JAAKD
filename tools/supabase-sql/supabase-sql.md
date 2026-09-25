## Supabase SQL Migration Order

Run these scripts in order for a new environment:

1. `00-create-profiles-table.sql`
2. `01-auth-trigger.sql`
3. `02-create-holdings-table.sql`
4. `03-update-trades-for-holdings.sql` (legacy compatibility/no-op depending on environment)
5. `04-holdings-fifo-projections.sql`
6. `05-drop-obsolete-trades-link.sql` (marker/no-op)
7. `06-seed-cash-instrument.sql`

## Phase 2 Persistence Verification

1. `holdings` has columns: `currentQuantity`, `cumulativeRealizedPnl`, `updatedAt`.
2. `holdings` enforces unique `(portfolioID, instrumentID)`.
3. `position_lots` table exists with checks for non-negative quantities and remaining <= original.
4. `lot_matches` table exists with positive matched quantity check.
5. FIFO scan index exists on open lots.
6. Idempotency indexes exist for source buy log and sell log + lot pair.
7. Cash instrument exists and is uniquely identified by stable lookup key:
	- ticker: `USD_CASH` (case-insensitive)

## Stable Lookup Key

- Cash instrument ticker key: `USD_CASH`
- Intended usage: resolve cash holding row in `holdings` for DEPOSIT/WITHDRAW flow.
