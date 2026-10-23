-- One row per instrument per calendar day, from its first real price to today, with the latest real price
-- known on that day. Weekends, holidays and days Fauxnance hasn't caught up on carry the last close forward.
--
-- Synthetic candles are ignored: Fauxnance generates them for days without real data (mostly US market
-- holidays), and their prices move although the market was closed. A closed market's price is its last close.
--
-- Cash has no prices (cash is valued through FX rates instead), so it doesn't appear here.

with real_prices as (
    select instrument_id, price_date, close, adj_close, currency
    from {{ ref('stg_instrument_prices') }}
    where not is_synthetic
),

-- Every day from each instrument's first real price to today.
instrument_days as (
    select first_prices.instrument_id, spine.date_day
    from (
        select instrument_id, min(price_date) as first_price_date
        from real_prices
        group by instrument_id
    ) as first_prices
    join {{ ref('int_date_spine') }} as spine
        on spine.date_day >= first_prices.first_price_date
),

-- Days without a real price have nulls. price_group counts the real prices seen so far, so it goes up by one on
-- each day with a price and stays the same on the days after it: each price and its carried-forward days share
-- a group.
with_gaps as (
    select
        days.instrument_id,
        days.date_day,
        prices.price_date,
        prices.close,
        prices.adj_close,
        prices.currency,
        count(prices.price_date) over (partition by days.instrument_id order by days.date_day) as price_group
    from instrument_days as days
    left join real_prices as prices
        on prices.instrument_id = days.instrument_id
        and prices.price_date = days.date_day
),

-- Within a group, the first row is the day with the real price; copy it onto the rest of the group.
filled as (
    select
        instrument_id,
        date_day,
        first_value(price_date) over price_window as price_date,
        first_value(close) over price_window as close,
        first_value(adj_close) over price_window as adj_close,
        first_value(currency) over price_window as currency
    from with_gaps
    window price_window as (partition by instrument_id, price_group order by date_day)
)

select
    instrument_id,
    date_day,
    -- The day the price comes from; earlier than date_day when it was carried forward.
    price_date,
    date_day <> price_date as is_carried_forward,
    close,
    adj_close,
    currency
from filled
