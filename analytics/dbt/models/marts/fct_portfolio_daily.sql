-- One row per portfolio per calendar day, from its first holding to today: total value, how much of it is
-- cash, money deposited or withdrawn that day, and the investment return, all in USD.
--
-- market_value_usd is the whole portfolio: every holding's market value plus cash (fct_holding_daily has both).
-- net_external_flow_usd is deposits - withdrawals that day. Trades and FX conversions move money around inside
-- the portfolio, so they aren't flows.
--
-- daily_return leaves deposits and withdrawals out, so adding money doesn't count as a gain:
--   (value today - net flow today) / value yesterday - 1
-- Flows are treated as arriving at the end of the day. The return is null when there was no value the day
-- before (e.g. the day of the first deposit), since there was nothing to earn a return on.
-- cumulative_twr chains the daily returns: (1 + r1) x (1 + r2) x ... - 1, written as exp(sum(ln(1 + r))) - 1
-- because SQL can sum rows but not multiply them. This is the time-weighted return: how well the investments
-- did, regardless of when money was added or taken out.
-- Returns are in USD, so currency moves on non-USD holdings count as gains or losses, as they would for a USD
-- investor.

with daily_values as (
    select
        holdings.portfolio_id,
        holdings.as_of_date,
        sum(holdings.market_value_usd) as market_value_usd,
        sum(holdings.market_value_usd) filter (where instruments.instrument_class = 'CASH') as cash_usd
    from {{ ref('fct_holding_daily') }} as holdings
    join {{ ref('stg_instruments') }} as instruments
        on instruments.instrument_id = holdings.instrument_id
    group by holdings.portfolio_id, holdings.as_of_date
),

daily_flows as (
    select
        cash.portfolio_id,
        cash.movement_date,
        sum(cash.external_flow * fx.usd_rate) as net_external_flow_usd
    from {{ ref('int_cash_movements') }} as cash
    join {{ ref('int_fx_to_usd') }} as fx
        on fx.currency = cash.currency
        and fx.date_day = cash.movement_date
    group by cash.portfolio_id, cash.movement_date
),

with_returns as (
    select
        values_.portfolio_id,
        values_.as_of_date,
        values_.market_value_usd,
        coalesce(values_.cash_usd, 0) as cash_usd,
        coalesce(flows.net_external_flow_usd, 0) as net_external_flow_usd,
        (values_.market_value_usd - coalesce(flows.net_external_flow_usd, 0))
            / nullif(lag(values_.market_value_usd) over portfolio_window, 0) - 1 as daily_return
    from daily_values as values_
    left join daily_flows as flows
        on flows.portfolio_id = values_.portfolio_id
        and flows.movement_date = values_.as_of_date
    window portfolio_window as (partition by values_.portfolio_id order by values_.as_of_date)
)

select
    portfolio_id,
    as_of_date,
    round(market_value_usd, 6) as market_value_usd,
    round(cash_usd, 6) as cash_usd,
    round(net_external_flow_usd, 6) as net_external_flow_usd,
    cast(daily_return as double precision) as daily_return,
    cast(
        -- coalesce: before the first return there's nothing to chain yet, so the return so far is 0.
        exp(coalesce(sum(ln(1 + daily_return)) over (partition by portfolio_id order by as_of_date), 0)) - 1
        as double precision
    ) as cumulative_twr
from with_returns
