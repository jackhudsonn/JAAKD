-- One row per currency per calendar day: how many US dollars one unit of that currency was worth.
-- USD is always 1. Other currencies come from FX instruments, with the same rule as HoldingService.resolveFxRate:
-- use the direct pair (EURUSD) if there is one, otherwise 1 / the inverse pair (USDEUR).
--
-- FX instruments are named <base><quote> (EURUSD; FX:EURUSD also works) and priced in units of quote per one
-- base, so EURUSD = 1.12 means 1 EUR = 1.12 USD. Rates are carried forward over weekends like any price.
-- A currency with no FX instrument gets no rows here; tests/assert_fx_rate_for_every_currency_used.sql
-- fails the build if money is held or traded in it.

with fx_pairs as (
    select
        instrument_id,
        left(pair, 3) as base_currency,
        right(pair, 3) as quote_currency
    from (
        select instrument_id, upper(replace(ticker, 'FX:', '')) as pair
        from {{ ref('stg_instruments') }}
        where instrument_class = 'FX'
    ) as fx_instruments
    where length(pair) = 6
),

-- close, not adj_close: a conversion uses the rate on the day (FX pays no dividends, so they're equal anyway).
pair_rates as (
    select pairs.base_currency, pairs.quote_currency, prices.date_day, prices.close as rate
    from fx_pairs as pairs
    join {{ ref('int_prices_filled') }} as prices
        on prices.instrument_id = pairs.instrument_id
),

direct_rates as (
    select base_currency as currency, date_day, rate as usd_rate
    from pair_rates
    where quote_currency = 'USD'
),

inverse_rates as (
    select quote_currency as currency, date_day, 1 / rate as usd_rate
    from pair_rates
    where base_currency = 'USD'
)

select 'USD' as currency, date_day, cast(1 as numeric) as usd_rate
from {{ ref('int_date_spine') }}

union all

select
    currency,
    date_day,
    coalesce(direct_rates.usd_rate, inverse_rates.usd_rate) as usd_rate
from direct_rates
full join inverse_rates using (currency, date_day)
