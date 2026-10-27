-- One row per holding per calendar day, from the day it was first bought (or the first cash movement) to today:
-- how much was held, what it cost, what it was worth, and the profit or loss, all in USD.
--
-- Built as a running total of each holding's changes over time:
--   lot opened (a BUY)           quantity + original quantity, cost + original quantity x unit cost
--   lot matched (part of a SELL) quantity - matched quantity,  cost - matched quantity x the lot's unit cost,
--                                realized P&L + the match's realizedPnlAmount (FIFO, from the backend)
--   cash movement                quantity and cost + the change (cash costs exactly its own amount)
-- Lots and matches are dated by their order's execution, the same date cash moves in int_cash_movements. (Their
-- own openedAt/matchedAt is when the backend processed them; in seeded data that's later than the order.)
--
-- Market value uses close, the price on the day (adj_close is for returns). Cost basis and market value are
-- converted to USD at the day's rate, so unrealized P&L = market value - cost basis. Realized P&L is converted
-- at the rate on the day it was realized, and stays at that USD amount afterwards. Cash is valued at 1 per unit
-- in its own currency, so its unrealized P&L is 0 (currency gains show up in the portfolio's value instead).

with holdings as (
    select
        holdings.holding_id,
        holdings.portfolio_id,
        holdings.instrument_id,
        instruments.instrument_class,
        instruments.trading_currency
    from {{ ref('stg_holdings') }} as holdings
    join {{ ref('stg_instruments') }} as instruments
        on instruments.instrument_id = holdings.instrument_id
),

order_log_order_ids as (
    select
        "logOrderID" as log_order_id,
        "orderID" as order_id
    from {{ source('raw', 'orderLogs') }}
),

execution_dates as (
    select
        log_order_id,
        order_id,
        side,
        cast(executed_at at time zone 'UTC' as date) as executed_date
    from {{ ref('stg_order_logs') }}
),

lot_opened as (
    select
        lots.holding_id,
        buys.executed_date as event_date,
        lots.original_quantity as quantity_change,
        lots.original_quantity * lots.unit_cost as cost_change,
        0 as realized_pnl_change
    from {{ ref('stg_position_lots') }} as lots
    join order_log_order_ids as source_buy
        on source_buy.log_order_id = lots.source_buy_log_order_id
    join execution_dates as buys
        on buys.order_id = source_buy.order_id
        and buys.side = 'BUY'
),

lot_matched as (
    select
        matches.holding_id,
        sells.executed_date as event_date,
        -matches.matched_quantity as quantity_change,
        -(matches.matched_quantity * lots.unit_cost) as cost_change,
        matches.realized_pnl_amount as realized_pnl_change
    from {{ ref('stg_lot_matches') }} as matches
    join {{ ref('stg_position_lots') }} as lots
        on lots.position_lot_id = matches.position_lot_id
    join order_log_order_ids as source_sell
        on source_sell.log_order_id = matches.sell_log_order_id
    join execution_dates as sells
        on sells.order_id = source_sell.order_id
        and sells.side = 'SELL'
),

cash_moved as (
    select
        holdings.holding_id,
        cash.movement_date as event_date,
        cash.cash_change as quantity_change,
        cash.cash_change as cost_change,
        0 as realized_pnl_change
    from {{ ref('int_cash_movements') }} as cash
    join holdings
        on holdings.portfolio_id = cash.portfolio_id
        and holdings.instrument_id = cash.instrument_id
),

-- All changes for each holding and day, with realized P&L converted to USD on the day it was realized.
daily_changes as (
    select
        events.holding_id,
        events.event_date,
        sum(events.quantity_change) as quantity_change,
        sum(events.cost_change) as cost_change,
        sum(events.realized_pnl_change * fx.usd_rate) as realized_pnl_change_usd
    from (
        select * from lot_opened
        union all
        select * from lot_matched
        union all
        select * from cash_moved
    ) as events
    join holdings
        on holdings.holding_id = events.holding_id
    left join {{ ref('int_fx_to_usd') }} as fx
        on fx.currency = holdings.trading_currency
        and fx.date_day = events.event_date
    group by events.holding_id, events.event_date
),

-- Every day from each holding's first change to today; days without changes keep the running totals.
holding_days as (
    select first_changes.holding_id, spine.date_day
    from (
        select holding_id, min(event_date) as first_date
        from daily_changes
        group by holding_id
    ) as first_changes
    join {{ ref('int_date_spine') }} as spine
        on spine.date_day >= first_changes.first_date
),

running_totals as (
    select
        days.holding_id,
        days.date_day,
        sum(coalesce(changes.quantity_change, 0)) over holding_window as quantity,
        sum(coalesce(changes.cost_change, 0)) over holding_window as cost_basis,
        sum(coalesce(changes.realized_pnl_change_usd, 0)) over holding_window as realized_pnl_to_date_usd
    from holding_days as days
    left join daily_changes as changes
        on changes.holding_id = days.holding_id
        and changes.event_date = days.date_day
    window holding_window as (partition by days.holding_id order by days.date_day)
),

valued as (
    select
        totals.holding_id,
        holdings.portfolio_id,
        holdings.instrument_id,
        totals.date_day as as_of_date,
        totals.quantity,
        totals.cost_basis,
        totals.quantity * case when holdings.instrument_class = 'CASH' then 1 else prices.close end as market_value,
        totals.realized_pnl_to_date_usd,
        fx.usd_rate
    from running_totals as totals
    join holdings
        on holdings.holding_id = totals.holding_id
    left join {{ ref('int_prices_filled') }} as prices
        on prices.instrument_id = holdings.instrument_id
        and prices.date_day = totals.date_day
    left join {{ ref('int_fx_to_usd') }} as fx
        on fx.currency = holdings.trading_currency
        and fx.date_day = totals.date_day
)

select
    holding_id,
    portfolio_id,
    instrument_id,
    as_of_date,
    quantity,
    round(cost_basis * usd_rate, 6) as cost_basis_usd,
    round(market_value * usd_rate, 6) as market_value_usd,
    round(realized_pnl_to_date_usd, 6) as realized_pnl_to_date_usd,
    round((market_value - cost_basis) * usd_rate, 6) as unrealized_pnl_usd
from valued
