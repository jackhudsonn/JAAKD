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
-- holder_count, exposure_usd and net_flow_30d_usd count retail portfolios only, summed from
-- agg_instrument_segment (see there).

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

-- Retail holdings and flows, summed over every country and age band.
platform as (
    select
        instrument_id,
        sum(holder_count) as holder_count,
        sum(exposure_usd) as exposure_usd,
        sum(net_flow_30d_usd) as net_flow_30d_usd
    from {{ ref('agg_instrument_segment') }}
    group by instrument_id
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
    cast(coalesce(platform.holder_count, 0) as bigint) as holder_count,
    round(coalesce(platform.exposure_usd, 0), 6) as exposure_usd,
    round(coalesce(platform.net_flow_30d_usd, 0), 6) as net_flow_30d_usd
from latest
join {{ ref('dim_instrument') }} as instruments
    on instruments.instrument_id = latest.instrument_id
left join risk
    on risk.instrument_id = latest.instrument_id
left join platform
    on platform.instrument_id = latest.instrument_id
