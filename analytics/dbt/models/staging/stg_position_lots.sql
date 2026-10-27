-- One row per FIFO lot: the shares bought by one BUY order, and how many are still held.
-- Prod stores timestamps without a time zone, in UTC; "at time zone 'UTC'" makes that explicit (timestamptz).

select
    "positionLotID" as position_lot_id,
    "holdingID" as holding_id,
    "sourceBuyLogOrderID" as source_buy_log_order_id,
    "openedAt" at time zone 'UTC' as opened_at,
    "originalQuantity" as original_quantity,
    "remainingQuantity" as remaining_quantity,
    "unitCost" as unit_cost
from {{ source('raw', 'position_lots') }}
