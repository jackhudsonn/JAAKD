-- One row: when the data was taken from prod and when the marts were built. Feeds "Data as of ..." in the
-- analyst view (/api/analytics/meta).
--   source_snapshot_at  the snapshot time of the latest copy run (copy/copy_raw.py writes it to raw._load_log)
--   built_at            when this dbt build finished the marts
--
-- The depends_on lines make dbt build this last: it reads none of these models, but built_at should only be
-- recorded once they're all done. If any of them fails, this is skipped and keeps the previous build's times.
-- depends_on: {{ ref('dim_instrument') }}
-- depends_on: {{ ref('dim_portfolio') }}
-- depends_on: {{ ref('fct_instrument_price_daily') }}
-- depends_on: {{ ref('fct_holding_daily') }}
-- depends_on: {{ ref('fct_portfolio_daily') }}
-- depends_on: {{ ref('agg_instrument_performance') }}
-- depends_on: {{ ref('agg_portfolio_performance') }}

select
    max(source_snapshot_at) as source_snapshot_at,
    now() as built_at
from {{ source('raw', '_load_log') }}
