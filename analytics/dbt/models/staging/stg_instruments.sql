-- One row per instrument (stocks, ETFs, crypto, FX pairs and cash), with snake_case names.

select
    "instrumentID" as instrument_id,
    ticker,
    name,
    market,
    "instrumentClass" as instrument_class,
    "tradingCurrency" as trading_currency
from {{ source('raw', 'instruments') }}
