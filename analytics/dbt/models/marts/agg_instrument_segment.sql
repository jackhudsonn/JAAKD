-- One row per instrument, country and age band: how much retail portfolios in that segment hold today and
-- have been buying. Lets the analyst view filter instrument exposure by country and age band, and compare
-- segments (/api/analytics/segments). agg_instrument_performance sums these rows for its platform totals, so
-- the filtered and unfiltered numbers always agree.
--
-- Retail portfolios only: admins, auditors and analysts don't trade, so any test activity of theirs would skew
-- the picture. Cash is left out: it's money waiting to be invested, not an investment.
-- A missing country is 'Unknown' and a missing age band 'unknown' (the copy job's label), so every row has a
-- segment. Only segments that hold the instrument or traded it in the last 30 days get a row.
--   holder_count      retail portfolios in the segment holding it today
--   exposure_usd      their total market value in it today
--   net_flow_30d_usd  their buys - sells over the last 30 days, in USD at each order's execution date

with retail as (
    select
        portfolio_id,
        coalesce(country, 'Unknown') as country,
        coalesce(age_band, 'unknown') as age_band
    from {{ ref('dim_portfolio') }}
    where user_type = 0
),

investments as (
    select instrument_id, trading_currency
    from {{ ref('dim_instrument') }}
    where instrument_class <> 'CASH'
),

holdings_today as (
    select
        holdings.instrument_id,
        retail.country,
        retail.age_band,
        count(*) filter (where holdings.quantity > 0) as holder_count,
        sum(holdings.market_value_usd) as exposure_usd
    from {{ ref('fct_holding_daily') }} as holdings
    join retail
        on retail.portfolio_id = holdings.portfolio_id
    join investments
        on investments.instrument_id = holdings.instrument_id
    where holdings.as_of_date = current_date
    group by holdings.instrument_id, retail.country, retail.age_band
),

flows_30d as (
    select
        orders.instrument_id,
        retail.country,
        retail.age_band,
        sum(
            case when orders.side = 'BUY' then 1 else -1 end
            * orders.quantity * orders.execution_price * fx.usd_rate
        ) as net_flow_30d_usd
    from {{ ref('stg_order_logs') }} as orders
    join retail
        on retail.portfolio_id = orders.portfolio_id
    join investments
        on investments.instrument_id = orders.instrument_id
    join {{ ref('int_fx_to_usd') }} as fx
        on fx.currency = investments.trading_currency
        and fx.date_day = cast(orders.executed_at at time zone 'UTC' as date)
    where orders.side in ('BUY', 'SELL')
        and orders.executed_at >= current_date - interval '30 days'
    group by orders.instrument_id, retail.country, retail.age_band
)

select
    coalesce(holdings_today.instrument_id, flows_30d.instrument_id) as instrument_id,
    coalesce(holdings_today.country, flows_30d.country) as country,
    coalesce(holdings_today.age_band, flows_30d.age_band) as age_band,
    coalesce(holdings_today.holder_count, 0) as holder_count,
    round(coalesce(holdings_today.exposure_usd, 0), 6) as exposure_usd,
    round(coalesce(flows_30d.net_flow_30d_usd, 0), 6) as net_flow_30d_usd
from holdings_today
full outer join flows_30d
    on flows_30d.instrument_id = holdings_today.instrument_id
    and flows_30d.country = holdings_today.country
    and flows_30d.age_band = holdings_today.age_band
where coalesce(holdings_today.holder_count, 0) > 0
    or coalesce(flows_30d.net_flow_30d_usd, 0) <> 0
