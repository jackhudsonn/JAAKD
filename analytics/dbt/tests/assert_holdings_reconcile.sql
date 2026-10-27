-- Fails when today's row in fct_holding_daily materially disagrees with the app's own holdings table. Both
-- ledgers store quantities and P&L to six decimal places; round before comparing to ignore double-precision
-- artifacts from order log quantities/prices. Other currencies' P&L is converted at past rates, so it cannot
-- be compared with the app's native amount.
-- A mismatch means the history rebuilt from lots, matches and cash movements has drifted from what the backend
-- actually did, and every daily value for that holding is suspect.
--
-- Returns one row per mismatched holding.

with today as (
    select *
    from {{ ref('fct_holding_daily') }}
    where as_of_date = current_date
),

buy_execution_links as (
    select
        lots.holding_id,
        array_agg(distinct executed.log_order_id) as executed_buy_log_ids
    from {{ ref('stg_position_lots') }} as lots
    join {{ source('raw', 'orderLogs') }} as source_buy_log
        on source_buy_log."logOrderID" = lots.source_buy_log_order_id
    join {{ ref('stg_order_logs') }} as executed
        on executed.order_id = source_buy_log."orderID"
        and executed.side = 'BUY'
    group by lots.holding_id
)

select
    app.holding_id,
    app.current_quantity as app_quantity,
    today.quantity as rebuilt_quantity,
    app.cumulative_realized_pnl as app_realized_pnl,
    today.realized_pnl_to_date_usd as rebuilt_realized_pnl_usd,
    buy_execution_links.executed_buy_log_ids
from {{ ref('stg_holdings') }} as app
join {{ ref('stg_instruments') }} as instruments
    on instruments.instrument_id = app.instrument_id
left join today
    on today.holding_id = app.holding_id
left join buy_execution_links
    on buy_execution_links.holding_id = app.holding_id
where round(coalesce(today.quantity, 0)::numeric, 2)
    <> round(app.current_quantity::numeric, 2)
    or (
        instruments.trading_currency = 'USD'
        and round(coalesce(today.realized_pnl_to_date_usd, 0)::numeric, 2)
            <> round(app.cumulative_realized_pnl::numeric, 2)
    )
