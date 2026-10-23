-- One row per part of a SELL matched against a lot (FIFO), with the profit or loss it realized.
-- Prod stores timestamps without a time zone, in UTC; "at time zone 'UTC'" makes that explicit (timestamptz).

select
    "lotMatchID" as lot_match_id,
    "sellLogOrderID" as sell_log_order_id,
    "positionLotID" as position_lot_id,
    "holdingID" as holding_id,
    "matchedQuantity" as matched_quantity,
    "sellUnitPrice" as sell_unit_price,
    "realizedPnlAmount" as realized_pnl_amount,
    "matchedAt" at time zone 'UTC' as matched_at
from {{ source('raw', 'lot_matches') }}
