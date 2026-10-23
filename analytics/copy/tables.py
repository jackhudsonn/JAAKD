"""Which tables and columns the nightly copy job moves from prod into the analytics database.

Each Table maps public.<name> on prod to raw.<name> on the analytics database (analytics/db/setup.sql).
Column names are copied exactly, including the quoted camelCase ones ("instrumentID").

To copy a new column: add it to the raw table in setup.sql, then to the list here. The copy job's
drift check fails if the raw table and this list disagree.

Sensitive data is left behind simply by not listing it: users, sessions, payment_methods,
preferences, watchlists, portfolio names, profile names and addresses. The prod role the job
connects as (jaakd_analytics_reader) can't read those anyway.
"""

from dataclasses import dataclass, field
from typing import LiteralString


@dataclass(frozen=True)
class Table:
    name: str
    # Columns of raw.<name>, in the order they're copied.
    columns: tuple[str, ...]
    # Columns that aren't copied as-is but computed on prod: raw column -> SQL expression.
    # LiteralString: the SQL must be written in code, never built from input at runtime.
    computed: dict[str, LiteralString] = field(default_factory=dict[str, LiteralString])


# Age band from dob, computed on prod so the birth date itself never leaves it. The labels must match
# the CHECK constraint on raw.profiles and AnalyticsService.AGE_BANDS in the backend.
AGE_BAND_SQL: LiteralString = """
CASE
  WHEN dob IS NULL THEN 'unknown'
  WHEN date_part('year', age(current_date, dob)) < 25 THEN '<25'
  WHEN date_part('year', age(current_date, dob)) < 35 THEN '25-34'
  WHEN date_part('year', age(current_date, dob)) < 45 THEN '35-44'
  WHEN date_part('year', age(current_date, dob)) < 55 THEN '45-54'
  WHEN date_part('year', age(current_date, dob)) < 65 THEN '55-64'
  ELSE '65+'
END
"""

TABLES = [
    
    Table("instruments", (
        "instrumentID", "ticker", "market", 
        "name", "instrumentClass", "tradingCurrency",
    )),
    
    Table("portfolios", (
        "portfolioID", "userID",
    )),
    
    Table("profiles", (
        "userID", "userType", "state", 
        "country", "ageBand",
    ), computed={"ageBand": AGE_BAND_SQL}),
    
    Table("holdings", (
        "holdingID", "portfolioID", "instrumentID", 
        "currentQuantity", "cumulativeRealizedPnl",
        "updatedAt",
    )),
    
    Table("orderLogs", (
        "logOrderID", "orderID", "portfolioID", 
        "instrumentID", "side", "quantity", 
        "timestamp", "metadata", "status", 
        "executionPrice", "quotedPrice",
    )),
    
    Table("position_lots", (
        "positionLotID", "holdingID", "sourceBuyLogOrderID", 
        "openedAt", "originalQuantity",
        "remainingQuantity", "unitCost",
    )),
    
    Table("lot_matches", (
        "lotMatchID", "sellLogOrderID", "positionLotID", 
        "holdingID", "matchedQuantity", "sellUnitPrice", 
        "realizedPnlAmount", "matchedAt",
    )),
    
    Table("instrumentPrices", (
        "instrumentID", "priceDate", "open", "high", 
        "low", "close", "adjClose", "volume",
        "currency", "synthetic", "fetchedAt",
    )),
]
