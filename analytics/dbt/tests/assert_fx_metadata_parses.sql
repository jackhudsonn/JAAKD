-- Fails when an FX conversion's target currency or amount can't be read from its metadata, or the target
-- currency has no cash instrument. int_cash_movements would otherwise drop the target side, and the money
-- would disappear from the portfolio's cash. Fix: update the parsing in int_cash_movements to match the
-- format HoldingService.buildFxMetadata writes.
--
-- Returns one row per unreadable FX order.

select
    orders.log_order_id,
    orders.metadata
from {{ ref('stg_order_logs') }} as orders
left join {{ ref('stg_instruments') }} as cash
    on cash.instrument_class = 'CASH'
    and cash.ticker = substring(orders.metadata from 'targetCurrency=([A-Z]{3})')
where orders.side = 'FX'
    and (
        substring(orders.metadata from 'targetAmount=([0-9.]+)') is null
        or cash.instrument_id is null
    )
