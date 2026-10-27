-- One row per portfolio. The portfolio name stays on prod (copy/tables.py).

select
    "portfolioID" as portfolio_id,
    "userID" as user_id
from {{ source('raw', 'portfolios') }}
