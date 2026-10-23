-- Fails when today's row in fct_holding_daily disagrees with the app's own holdings table: the quantity (shares
-- or cash balance) must be identical, and so must realized P&L for holdings traded in USD (other currencies are
-- converted at past rates, so they can't be compared with the app's native amount).
-- A mismatch means the history rebuilt from lots, matches and cash movements has drifted from what the backend
-- actually did, and every daily value for that holding is suspect.
--
-- Returns one row per mismatched holding.

with today as (
    select *
    from {{ ref('fct_holding_daily') }}
    where as_of_date = current_date
)

select
    app.holding_id,
    app.current_quantity as app_quantity,
    today.quantity as rebuilt_quantity,
    app.cumulative_realized_pnl as app_realized_pnl,
    today.realized_pnl_to_date_usd as rebuilt_realized_pnl_usd
from {{ ref('stg_holdings') }} as app
join {{ ref('stg_instruments') }} as instruments
    on instruments.instrument_id = app.instrument_id
left join today
    on today.holding_id = app.holding_id
where coalesce(today.quantity, 0) <> app.current_quantity
    or (
        instruments.trading_currency = 'USD'
        and coalesce(today.realized_pnl_to_date_usd, 0) <> app.cumulative_realized_pnl
    )
