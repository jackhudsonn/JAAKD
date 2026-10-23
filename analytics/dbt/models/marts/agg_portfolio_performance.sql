-- One row per portfolio: today's value, how it has performed, and its profit or loss. This is the analyst
-- view's portfolio table; the owner fields (user type, country, age band) are there to filter and group by.
-- Portfolios with no activity yet are included, with a value of 0 and no returns.
--
-- Returns over a window use the time-weighted return, so deposits and withdrawals don't count:
-- (1 + cumulative_twr today) / (1 + cumulative_twr on the window's start date) - 1. fct_portfolio_daily has
-- every calendar day, so the start is an exact date; a portfolio younger than the window has no return (null).
-- YTD starts from the previous year's last day.
-- Volatility and max drawdown cover the last year. Volatility uses weekdays only (weekends always return 0%,
-- which would make every portfolio look calmer), annualised with sqrt(252) like agg_instrument_performance.
-- realized_pnl_usd and unrealized_pnl_usd add up today's holdings (fct_holding_daily), so they cover investments
-- only: cash has no P&L there. Currency gains or losses on foreign cash (euros held while EURUSD rises) are in
-- market_value_usd and the returns, but not in P&L, so:
--   market_value_usd - net deposits = realized + unrealized + currency gains on cash

{% set return_windows = {
    'return_1w': "current_date - 7",
    'return_1m': "cast(current_date - interval '1 month' as date)",
    'return_3m': "cast(current_date - interval '3 months' as date)",
    'return_ytd': "make_date(cast(extract(year from current_date) as int), 1, 1) - 1",
} %}

with daily as (
    select * from {{ ref('fct_portfolio_daily') }}
),

today as (
    select * from daily where as_of_date = current_date
),

-- The last year, with each day's fall from the highest value so far within that year.
last_year as (
    select
        portfolio_id,
        as_of_date,
        daily_return,
        (1 + cumulative_twr)
            / max(1 + cumulative_twr) over (partition by portfolio_id order by as_of_date) - 1 as drawdown
    from daily
    where as_of_date > current_date - interval '1 year'
),

risk as (
    select
        portfolio_id,
        stddev_samp(daily_return) filter (where extract(isodow from as_of_date) < 6) * sqrt(252) as volatility_ann,
        min(drawdown) as max_drawdown
    from last_year
    group by portfolio_id
),

pnl_today as (
    select
        portfolio_id,
        sum(realized_pnl_to_date_usd) as realized_pnl_usd,
        sum(unrealized_pnl_usd) as unrealized_pnl_usd
    from {{ ref('fct_holding_daily') }}
    where as_of_date = current_date
    group by portfolio_id
)

select
    portfolios.portfolio_id,
    portfolios.user_id,
    portfolios.user_type,
    portfolios.country,
    portfolios.age_band,
    coalesce(today.market_value_usd, 0) as market_value_usd,
    {%- for column, window_start in return_windows.items() %}
    cast(
        (1 + today.cumulative_twr) / (
            select 1 + start.cumulative_twr
            from daily as start
            where start.portfolio_id = portfolios.portfolio_id
                and start.as_of_date = {{ window_start }}
        ) - 1
        as double precision
    ) as {{ column }},
    {%- endfor %}
    cast(risk.volatility_ann as double precision) as volatility_ann,
    cast(risk.max_drawdown as double precision) as max_drawdown,
    round(coalesce(pnl_today.realized_pnl_usd, 0), 6) as realized_pnl_usd,
    round(coalesce(pnl_today.unrealized_pnl_usd, 0), 6) as unrealized_pnl_usd
from {{ ref('dim_portfolio') }} as portfolios
left join today
    on today.portfolio_id = portfolios.portfolio_id
left join risk
    on risk.portfolio_id = portfolios.portfolio_id
left join pnl_today
    on pnl_today.portfolio_id = portfolios.portfolio_id
