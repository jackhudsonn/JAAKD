-- One row per instrument per trading day (daily candles from Fauxnance, saved by the backend's price job).
-- close is already adjusted for splits (AMZN's 2022 20-for-1 split doesn't show as a drop); adj_close is also
-- adjusted for dividends, so it's the one to use for returns.
-- is_synthetic marks gap-filling candles Fauxnance generated, so marts can flag or exclude those days.
-- Prod stores timestamps without a time zone, in UTC; "at time zone 'UTC'" makes that explicit (timestamptz).

select
    "instrumentID" as instrument_id,
    "priceDate" as price_date,
    open,
    high,
    low,
    close,
    "adjClose" as adj_close,
    volume,
    currency,
    synthetic as is_synthetic,
    "fetchedAt" at time zone 'UTC' as fetched_at
from {{ source('raw', 'instrumentPrices') }}
