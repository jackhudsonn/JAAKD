-- Apply this migration to existing databases that were created before
-- trading currency and FX order-side support were introduced.

BEGIN;

ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS "tradingCurrency" TEXT;

-- Backfill instrument trading currency.
-- 1) For cash instruments, derive from ticker when it is one of supported codes.
-- 2) For all remaining rows, default to USD.
UPDATE public.instruments i
SET "tradingCurrency" = UPPER(i.ticker)
WHERE i."tradingCurrency" IS NULL
  AND i."instrumentClass" = 'CASH'
  AND UPPER(i.ticker) IN ('USD', 'INR', 'GBP', 'EUR');

UPDATE public.instruments
SET "tradingCurrency" = 'USD'
WHERE "tradingCurrency" IS NULL;

ALTER TABLE public.instruments
  ALTER COLUMN "tradingCurrency" SET NOT NULL;

ALTER TABLE public.instruments
  ALTER COLUMN "tradingCurrency" SET DEFAULT 'USD';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_instruments_trading_currency'
      AND conrelid = 'public.instruments'::regclass
  ) THEN
    ALTER TABLE public.instruments
      ADD CONSTRAINT chk_instruments_trading_currency
      CHECK ("tradingCurrency" IN ('USD', 'INR', 'GBP', 'EUR'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_orderlogs_side'
      AND conrelid = 'public."orderLogs"'::regclass
  ) THEN
    ALTER TABLE public."orderLogs"
      DROP CONSTRAINT chk_orderlogs_side;
  END IF;

  ALTER TABLE public."orderLogs"
    ADD CONSTRAINT chk_orderlogs_side
    CHECK (side IN ('BUY', 'SELL', 'DEPOSIT', 'WITHDRAW', 'FX'));
END $$;

COMMIT;
