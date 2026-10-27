-- Fails when money is traded or held in a currency that has no USD rate (int_fx_to_usd), from the day the
-- currency was first used to today. Without a rate, that money can't be valued and portfolio values are wrong.
-- Fix: add the FX instrument (e.g. EURUSD) to prod so the backend's price job fetches its history.
--
-- Returns one row per missing currency, with how many days lack a rate.

with currency_used as (
    select instruments.trading_currency as currency, cast(orders.executed_at at time zone 'UTC' as date) as used_on
    from {{ ref('stg_order_logs') }} as orders
    join {{ ref('stg_instruments') }} as instruments
        on instruments.instrument_id = orders.instrument_id

    union all

    -- Held now, e.g. the target of an FX conversion, which has no order of its own.
    select instruments.trading_currency, current_date
    from {{ ref('stg_holdings') }} as holdings
    join {{ ref('stg_instruments') }} as instruments
        on instruments.instrument_id = holdings.instrument_id
    where holdings.current_quantity <> 0
),

days_needed as (
    select first_use.currency, spine.date_day
    from (
        select currency, min(used_on) as first_day
        from currency_used
        group by currency
    ) as first_use
    join {{ ref('int_date_spine') }} as spine
        on spine.date_day >= first_use.first_day
)

select
    days_needed.currency,
    count(*) as days_without_rate,
    min(days_needed.date_day) as first_day_without_rate
from days_needed
left join {{ ref('int_fx_to_usd') }} as fx
    on fx.currency = days_needed.currency
    and fx.date_day = days_needed.date_day
where fx.usd_rate is null
group by days_needed.currency
