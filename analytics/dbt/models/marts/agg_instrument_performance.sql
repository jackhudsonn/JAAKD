-- One row per priced instrument (cash has no prices): its latest close and how it has performed, plus how much
-- of it portfolios on the platform hold and have been buying. This is the analyst view's instrument table.
--
-- Returns over a window compare the latest close with the last close on or before the window's start, using
-- cumulative_return (adj_close based): (1 + latest) / (1 + start) - 1. YTD starts from the last close of the
-- previous year. The start close must be at most 7 days before the window's start (weekends and holidays are
-- shorter); if prices are missing for longer, or the instrument is newer than the window, the return is null
-- rather than quietly covering a longer period.
-- Volatility and max drawdown cover the last year of trading days:
--   volatility_ann  standard deviation of daily returns x sqrt(252 trading days a year)
--   max_drawdown    the worst fall from a high to a later low, e.g. -0.3 = -30%
-- (Crypto trades every day, so sqrt(365) would suit it better; 252 keeps every instrument on the same scale.)
-- holder_count and exposure_usd are as of today; net_flow_30d_usd is buys - sells over the last 30 days, in USD
-- at each order's execution date.

{% set return_windows = {
    'return_1w': "latest.price_date - interval '7 days'",
    'return_1m': "latest.price_date - interval '1 month'",
    'return_3m': "latest.price_date - interval '3 months'",
    'return_ytd': "make_date(cast(extract(year from latest.price_date) as int), 1, 1) - 1",
} %}

with prices as (
    select * from {{ ref('fct_instrument_price_daily') }}
),

latest as (
    select distinct on (instrument_id) *
    from prices
    order by instrument_id, price_date desc
),

-- The last year of trading days, with each day's fall from the highest value so far within that year.
last_year as (
    select
        prices.instrument_id,
        prices.daily_return,
        (1 + prices.cumulative_return)
            / max(1 + prices.cumulative_return) over (
                partition by prices.instrument_id order by prices.price_date
            ) - 1 as drawdown
    from prices
    join latest
        on latest.instrument_id = prices.instrument_id
    where prices.price_date > latest.price_date - interval '1 year'
),

risk as (
    select
        instrument_id,
        stddev_samp(daily_return) * sqrt(252) as volatility_ann,
        min(drawdown) as max_drawdown
    from last_year
    group by instrument_id
),

holdings_today as (
    select
        instrument_id,
        count(*) filter (where quantity > 0) as holder_count,
        sum(market_value_usd) as exposure_usd
    from {{ ref('fct_holding_daily') }}
    where as_of_date = current_date
    group by instrument_id
),

flows_30d as (
    select
        orders.instrument_id,
        sum(
            case when orders.side = 'BUY' then 1 else -1 end
            * orders.quantity * orders.execution_price * fx.usd_rate
        ) as net_flow_30d_usd
    from {{ ref('stg_order_logs') }} as orders
    join {{ ref('dim_instrument') }} as instruments
        on instruments.instrument_id = orders.instrument_id
    join {{ ref('int_fx_to_usd') }} as fx
        on fx.currency = instruments.trading_currency
        and fx.date_day = cast(orders.executed_at at time zone 'UTC' as date)
    where orders.side in ('BUY', 'SELL')
        and orders.executed_at >= current_date - interval '30 days'
    group by orders.instrument_id
)

select
    latest.instrument_id,
    instruments.ticker,
    instruments.name,
    instruments.instrument_class,
    latest.close_usd as last_close_usd,
    {%- for column, window_start in return_windows.items() %}
    cast(
        (1 + latest.cumulative_return) / (
            select 1 + start.cumulative_return
            from prices as start
            where start.instrument_id = latest.instrument_id
                and start.price_date <= {{ window_start }}
                and start.price_date > {{ window_start }} - interval '7 days'
            order by start.price_date desc
            limit 1
        ) - 1
        as double precision
    ) as {{ column }},
    {%- endfor %}
    cast(risk.volatility_ann as double precision) as volatility_ann,
    cast(risk.max_drawdown as double precision) as max_drawdown,
    coalesce(holdings_today.holder_count, 0) as holder_count,
    round(coalesce(holdings_today.exposure_usd, 0), 6) as exposure_usd,
    round(coalesce(flows_30d.net_flow_30d_usd, 0), 6) as net_flow_30d_usd
from latest
join {{ ref('dim_instrument') }} as instruments
    on instruments.instrument_id = latest.instrument_id
left join risk
    on risk.instrument_id = latest.instrument_id
left join holdings_today
    on holdings_today.instrument_id = latest.instrument_id
left join flows_30d
    on flows_30d.instrument_id = latest.instrument_id
