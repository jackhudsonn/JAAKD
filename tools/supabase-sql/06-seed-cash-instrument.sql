-- Seed canonical cash instrument used for DEPOSIT/WITHDRAW holdings projection
-- Stable lookup key: ticker = 'USD_CASH' (case-insensitive)

INSERT INTO instruments (
  "instrumentID",
  ticker,
  market,
  name,
  "instrumentClass",
  "logoUrl",
  description
)
SELECT
  gen_random_uuid(),
  'USD_CASH',
  'INTERNAL',
  'US Dollar Cash Balance',
  'USD',
  NULL,
  'Synthetic cash instrument used to represent portfolio cash balance in holdings.'
WHERE NOT EXISTS (
  SELECT 1
  FROM instruments i
  WHERE UPPER(i.ticker) = 'USD_CASH'
);
