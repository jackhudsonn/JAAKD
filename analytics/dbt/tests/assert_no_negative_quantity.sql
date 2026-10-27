-- Fails when a holding's rebuilt quantity (shares, or cash balance for a cash holding) drops below zero on any day.
-- The backend never lets a portfolio sell more than it holds or spend cash it doesn't have, so a negative day
-- means the history is missing an event or dates one too late: a lot opened after its matching sell, or a cash
-- outflow counted before the deposit or FX conversion that funded it. assert_holdings_reconcile only checks
-- today, so this catches errors in the past that have since evened out.
--
-- Returns one row per affected holding: the first negative day, the lowest quantity, and how many days were negative.

select
    holding_id,
    min(as_of_date) as first_negative_date,
    min(quantity) as lowest_quantity,
    count(*) as negative_days
from {{ ref('fct_holding_daily') }}
where quantity < 0
group by holding_id
