-- The analytics mart contract (built by analytics/dbt in real environments), recreated for AnalyticsServiceTest.
-- Runs on H2 in PostgreSQL mode, so it sticks to types both databases understand.

DROP SCHEMA IF EXISTS analytics CASCADE;
CREATE SCHEMA analytics;

CREATE TABLE analytics.dim_instrument (
  instrument_id UUID PRIMARY KEY,
  ticker VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  market VARCHAR(64) NOT NULL,
  instrument_class VARCHAR(16) NOT NULL,
  trading_currency VARCHAR(8) NOT NULL
);

CREATE TABLE analytics.dim_portfolio (
  portfolio_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  user_type INT NOT NULL,
  country VARCHAR(64),
  state VARCHAR(64),
  age_band VARCHAR(16) NOT NULL
);

CREATE TABLE analytics.fct_instrument_price_daily (
  instrument_id UUID NOT NULL,
  price_date DATE NOT NULL,
  close NUMERIC(24, 10) NOT NULL,
  close_usd NUMERIC(24, 10) NOT NULL,
  daily_return NUMERIC(24, 10),
  cumulative_return NUMERIC(24, 10)
);

CREATE TABLE analytics.fct_holding_daily (
  holding_id UUID NOT NULL,
  portfolio_id UUID NOT NULL,
  instrument_id UUID NOT NULL,
  as_of_date DATE NOT NULL,
  quantity NUMERIC(24, 10) NOT NULL,
  cost_basis_usd NUMERIC(24, 10) NOT NULL,
  market_value_usd NUMERIC(24, 10),
  realized_pnl_to_date_usd NUMERIC(24, 10) NOT NULL,
  unrealized_pnl_usd NUMERIC(24, 10)
);

CREATE TABLE analytics.fct_portfolio_daily (
  portfolio_id UUID NOT NULL,
  as_of_date DATE NOT NULL,
  market_value_usd NUMERIC(24, 10) NOT NULL,
  cash_usd NUMERIC(24, 10) NOT NULL,
  net_external_flow_usd NUMERIC(24, 10) NOT NULL,
  daily_return NUMERIC(24, 10),
  cumulative_twr NUMERIC(24, 10)
);

CREATE TABLE analytics.agg_instrument_performance (
  instrument_id UUID PRIMARY KEY,
  ticker VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  instrument_class VARCHAR(16) NOT NULL,
  last_close_usd NUMERIC(24, 10),
  return_1w NUMERIC(24, 10),
  return_1m NUMERIC(24, 10),
  return_3m NUMERIC(24, 10),
  return_ytd NUMERIC(24, 10),
  volatility_ann NUMERIC(24, 10),
  max_drawdown NUMERIC(24, 10),
  holder_count BIGINT NOT NULL,
  exposure_usd NUMERIC(24, 10) NOT NULL,
  net_flow_30d_usd NUMERIC(24, 10) NOT NULL
);

CREATE TABLE analytics.agg_portfolio_performance (
  portfolio_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  user_type INT NOT NULL,
  country VARCHAR(64),
  age_band VARCHAR(16) NOT NULL,
  market_value_usd NUMERIC(24, 10) NOT NULL,
  return_1w NUMERIC(24, 10),
  return_1m NUMERIC(24, 10),
  return_3m NUMERIC(24, 10),
  return_ytd NUMERIC(24, 10),
  volatility_ann NUMERIC(24, 10),
  max_drawdown NUMERIC(24, 10),
  realized_pnl_usd NUMERIC(24, 10) NOT NULL,
  unrealized_pnl_usd NUMERIC(24, 10) NOT NULL
);

CREATE TABLE analytics.meta_build (
  source_snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL,
  built_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Instruments: AAPL and MSFT equities, BTC crypto (no 1M return yet), EURUSD FX (no aggregates).
INSERT INTO analytics.dim_instrument VALUES
  ('00000000-0000-0000-0000-00000000000a', 'AAPL', 'Apple Inc.', 'NASDAQ', 'EQUITY', 'USD'),
  ('00000000-0000-0000-0000-00000000000b', 'MSFT', 'Microsoft Corp.', 'NASDAQ', 'EQUITY', 'USD'),
  ('00000000-0000-0000-0000-00000000000c', 'BTC-USD', 'Bitcoin', 'CRYPTO', 'CRYPTO', 'USD'),
  ('00000000-0000-0000-0000-00000000000d', 'EURUSD', 'Euro / US Dollar', 'FX', 'FX', 'USD');

INSERT INTO analytics.agg_instrument_performance VALUES
  ('00000000-0000-0000-0000-00000000000a', 'AAPL', 'Apple Inc.', 'EQUITY', 343.46, 0.01, 0.05, 0.12, 0.20, 0.25, -0.10, 3, 30000, 1500),
  ('00000000-0000-0000-0000-00000000000b', 'MSFT', 'Microsoft Corp.', 'EQUITY', 410.00, -0.02, 0.02, 0.06, 0.15, 0.22, -0.08, 2, 12000, -200),
  ('00000000-0000-0000-0000-00000000000c', 'BTC-USD', 'Bitcoin', 'CRYPTO', 67000.00, 0.04, NULL, NULL, NULL, NULL, NULL, 1, 5000, 0);

INSERT INTO analytics.fct_instrument_price_daily VALUES
  ('00000000-0000-0000-0000-00000000000a', DATE '2026-10-14', 342.96, 342.96, NULL, 0),
  ('00000000-0000-0000-0000-00000000000a', DATE '2026-10-15', 342.00, 342.00, -0.0028, -0.0028),
  ('00000000-0000-0000-0000-00000000000a', DATE '2026-10-16', 343.46, 343.46, 0.0043, 0.0015),
  ('00000000-0000-0000-0000-00000000000a', DATE '2024-01-02', 185.00, 185.00, NULL, NULL);

-- Portfolios: P1 in the US (retail, 25-34), P2 in GB (retail, 35-44).
INSERT INTO analytics.dim_portfolio VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', 0, 'US', 'MA', '25-34'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e2', 0, 'GB', NULL, '35-44');

INSERT INTO analytics.agg_portfolio_performance VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', 0, 'US', '25-34', 4500, 0.01, 0.04, 0.09, 0.18, 0.20, -0.07, 120, 340),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e2', 0, 'GB', '35-44', 9000, -0.01, 0.01, 0.03, 0.05, 0.15, -0.12, -50, 80);

INSERT INTO analytics.fct_portfolio_daily VALUES
  ('00000000-0000-0000-0000-0000000000f1', DATE '2026-10-15', 4400, 1000, 0, NULL, 0),
  ('00000000-0000-0000-0000-0000000000f1', DATE '2026-10-16', 4500, 1000, 0, 0.0227, 0.0227);

-- Holdings in P1: AAPL open on both days; MSFT closed (quantity 0) on the latest day.
INSERT INTO analytics.fct_holding_daily VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', DATE '2026-10-15', 10, 3000, 3420, 0, 420),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', DATE '2026-10-16', 10, 3000, 3434.6, 0, 434.6),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b', DATE '2026-10-15', 2, 800, 820, 0, 20),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b', DATE '2026-10-16', 0, 0, 0, 120, 0);

INSERT INTO analytics.meta_build VALUES
  (TIMESTAMP WITH TIME ZONE '2026-10-19 22:30:00+00', TIMESTAMP WITH TIME ZONE '2026-10-19 22:41:00+00');
