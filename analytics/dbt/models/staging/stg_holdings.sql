-- One row per holding (an instrument inside a portfolio), as it stands now. Cash is a holding too.
-- Prod stores timestamps without a time zone, in UTC; "at time zone 'UTC'" makes that explicit (timestamptz).

select
    "holdingID" as holding_id,
    "portfolioID" as portfolio_id,
    "instrumentID" as instrument_id,
    "currentQuantity" as current_quantity,
    "cumulativeRealizedPnl" as cumulative_realized_pnl,
    "updatedAt" at time zone 'UTC' as updated_at
from {{ source('raw', 'holdings') }}
