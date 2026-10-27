-- One row per instrument per day it has a real price (trading days; no weekends, holidays or synthetic candles):
-- the close, the close in USD, and the return for that day and since the first price.
--
-- Trading days only, unlike fct_holding_daily: returns between two closes are what volatility and drawdown are
-- measured on (agg_instrument_performance annualises with 252 trading days), and weekend rows would add fake 0%
-- days.
--
-- Returns use adj_close (adjusted for dividends as well as splits) and are in the instrument's own currency,
-- the usual way to compare instruments; close_usd is for showing prices side by side.

with real_prices as (
    select instrument_id, price_date, close, adj_close, currency
    from {{ ref('stg_instrument_prices') }}
    where not is_synthetic
)

select
    prices.instrument_id,
    prices.price_date,
    prices.close,
    round(prices.close * fx.usd_rate, 6) as close_usd,
    cast(
        prices.adj_close / lag(prices.adj_close) over instrument_window - 1
        as double precision
    ) as daily_return,
    cast(
        prices.adj_close / first_value(prices.adj_close) over instrument_window - 1
        as double precision
    ) as cumulative_return
from real_prices as prices
left join {{ ref('int_fx_to_usd') }} as fx
    on fx.currency = prices.currency
    and fx.date_day = prices.price_date
window instrument_window as (partition by prices.instrument_id order by prices.price_date)
