-- One row per executed order: trades (BUY, SELL), cash movements (DEPOSIT, WITHDRAW) and currency conversions (FX).
--
-- orderLogs is append-only: each stage of an order (SUBMITTED > PENDING > ACCEPTED > EXECUTED) adds a row.
-- Only the EXECUTED row changed holdings or cash, so it's the only one analytics needs. The backend refuses
-- to execute an order twice (OrderLogService), and _stg_models.yml tests that order_id stays unique here.
--
-- quantity and executionPrice are floating point on prod; they're cast to numeric so cash and P&L sums are
-- exact decimal arithmetic. For DEPOSIT and WITHDRAW, quantity is the cash amount and execution_price isn't
-- used (PortfolioReconciliationService ignores it too). For FX rows, quantity is the source amount and
-- execution_price the rate; the target currency and amount are in metadata (parsed in int_cash_movements).
-- Prod stores timestamps without a time zone, in UTC; "at time zone 'UTC'" makes that explicit (timestamptz).

select
    "logOrderID" as log_order_id,
    "orderID" as order_id,
    "portfolioID" as portfolio_id,
    "instrumentID" as instrument_id,
    side,
    cast(quantity as numeric) as quantity,
    cast("executionPrice" as numeric) as execution_price,
    "timestamp" at time zone 'UTC' as executed_at,
    metadata
from {{ source('raw', 'orderLogs') }}
where status = 'EXECUTED'
