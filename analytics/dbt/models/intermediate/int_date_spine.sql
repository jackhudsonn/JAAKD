-- One row per calendar day, weekends and holidays included, from the first day we know anything about
-- (the earliest price or executed order) to today. Daily marts join to this so a day with no trades and
-- no prices still gets a row; prices are carried forward onto those days in int_prices_filled.
--
-- Starts at the earlier of the two because price history (5 years, backfilled) goes back further than
-- trading on the platform, and instrument charts should show all of it.
-- Days are UTC: executed_at is converted to a UTC date, and current_date is UTC because the analytics
-- database's time zone is UTC (analytics/db/setup.sql).

with bounds as (
    select least(
        (select min(price_date) from {{ ref('stg_instrument_prices') }}),
        (select min(cast(executed_at at time zone 'UTC' as date)) from {{ ref('stg_order_logs') }})
    ) as first_day
)

select cast(day as date) as date_day
from bounds
cross join generate_series(bounds.first_day, current_date, interval '1 day') as day
