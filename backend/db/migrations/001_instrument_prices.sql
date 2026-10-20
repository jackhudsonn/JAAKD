-- Adds "instrumentPrices" to an existing database (Lightsail prod, Supabase dev).
-- Fresh databases get the same table from backend/db/init/01-schema.sql.
-- Safe to rerun. Run as the database owner BEFORE deploying the backend that maps InstrumentPrice,
-- because Hibernate validates the schema on startup (ddl-auto: validate).

BEGIN;

CREATE TABLE IF NOT EXISTS "instrumentPrices" (
  "instrumentID" UUID NOT NULL,
  "priceDate" DATE NOT NULL,
  open NUMERIC(24,10) NOT NULL,
  high NUMERIC(24,10) NOT NULL,
  low NUMERIC(24,10) NOT NULL,
  close NUMERIC(24,10) NOT NULL,
  "adjClose" NUMERIC(24,10) NOT NULL,
  volume BIGINT,
  currency TEXT NOT NULL,
  synthetic BOOLEAN NOT NULL DEFAULT false,
  "fetchedAt" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("instrumentID", "priceDate"),
  CONSTRAINT fk_instrument_prices_instruments
    FOREIGN KEY ("instrumentID") REFERENCES instruments("instrumentID")
    ON DELETE CASCADE,
  CONSTRAINT chk_instrument_prices_positive
    CHECK (open > 0 AND high > 0 AND low > 0 AND close > 0 AND "adjClose" > 0),
  CONSTRAINT chk_instrument_prices_currency_not_blank
    CHECK (btrim(currency) <> '')
);

GRANT SELECT, INSERT, UPDATE ON TABLE "instrumentPrices" TO jaakd_app;

COMMIT;
