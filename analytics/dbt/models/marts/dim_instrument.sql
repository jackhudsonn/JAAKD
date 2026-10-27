-- One row per instrument: the descriptive fields the analyst view shows and filters by (ticker, name, class).

select
    instrument_id,
    ticker,
    name,
    market,
    instrument_class,
    trading_currency
from {{ ref('stg_instruments') }}
