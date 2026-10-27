-- One row per portfolio per cash instrument per day with movements: the net change in that cash balance, in
-- its own currency, and how much of it was money entering or leaving the platform (external_flow).
--
-- Same rules as the backend applies when an order executes (FifoAccountingService, HoldingService.convertCash):
--   BUY       cash in the instrument's trading currency goes down by quantity x price
--   SELL      it goes up by quantity x price
--   DEPOSIT   the order's cash instrument goes up by quantity   (external: money entering)
--   WITHDRAW  it goes down by quantity                          (external: money leaving)
--   FX        the source currency (the order's instrument) goes down by quantity; the target currency goes up
--             by targetAmount. The target side only exists in metadata ("...;targetCurrency=EUR;...;
--             targetAmount=893.500000;..."), so it's parsed from there.
-- Trades and FX conversions only move money around inside a portfolio, so they're not external flows.
--
-- Each movement is rounded to 6 decimals, like the holdings ledger (NUMERIC(19,6)) stores every balance change,
-- so balances built from these match the app's holdings exactly.

with orders as (
    select
        orders.portfolio_id,
        orders.side,
        orders.quantity,
        orders.execution_price,
        orders.metadata,
        cast(orders.executed_at at time zone 'UTC' as date) as movement_date,
        instruments.trading_currency
    from {{ ref('stg_order_logs') }} as orders
    join {{ ref('stg_instruments') }} as instruments
        on instruments.instrument_id = orders.instrument_id
),

movements as (
    select
        portfolio_id,
        movement_date,
        trading_currency as currency,
        case when side = 'BUY' then -(quantity * execution_price) else quantity * execution_price end as cash_change,
        0 as external_flow
    from orders
    where side in ('BUY', 'SELL')

    union all

    -- The same amount twice: it changes the balance, and all of it is money entering or leaving.
    select
        portfolio_id,
        movement_date,
        trading_currency as currency,
        case when side = 'DEPOSIT' then quantity else -quantity end as cash_change,
        case when side = 'DEPOSIT' then quantity else -quantity end as external_flow
    from orders
    where side in ('DEPOSIT', 'WITHDRAW')

    union all

    -- FX, source side
    select
        portfolio_id,
        movement_date,
        trading_currency as currency,
        -quantity as cash_change,
        0 as external_flow
    from orders
    where side = 'FX'

    union all

    -- FX, target side (tests/assert_fx_metadata_parses.sql fails the build if these can't be read)
    select
        portfolio_id,
        movement_date,
        substring(metadata from 'targetCurrency=([A-Z]{3})') as currency,
        cast(substring(metadata from 'targetAmount=([0-9.]+)') as numeric) as cash_change,
        0 as external_flow
    from orders
    where side = 'FX'
)

select
    movements.portfolio_id,
    cash.instrument_id,
    movements.currency,
    movements.movement_date,
    sum(round(movements.cash_change, 6)) as cash_change,
    sum(round(movements.external_flow, 6)) as external_flow
from movements
join {{ ref('stg_instruments') }} as cash
    on cash.instrument_class = 'CASH'
    and cash.ticker = movements.currency
group by movements.portfolio_id, cash.instrument_id, movements.currency, movements.movement_date
