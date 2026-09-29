CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  "userID" UUID PRIMARY KEY,
  email TEXT NOT NULL,
  "userType" NUMERIC NOT NULL DEFAULT 0,
  "firstName" TEXT,
  "lastName" TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  "zipCode" TEXT,
  dob DATE,
  username TEXT,
  avatar TEXT
);

CREATE TABLE IF NOT EXISTS portfolios (
  "portfolioID" UUID PRIMARY KEY,
  "userID" UUID NOT NULL,
  "portfolioName" TEXT
);

CREATE TABLE IF NOT EXISTS instruments (
  "instrumentID" UUID PRIMARY KEY,
  ticker TEXT NOT NULL,
  market TEXT NOT NULL,
  name TEXT NOT NULL,
  "instrumentClass" TEXT NOT NULL,
  "logoUrl" TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS holdings (
  "holdingID" UUID PRIMARY KEY,
  "portfolioID" UUID NOT NULL,
  "instrumentID" UUID NOT NULL,
  "currentQuantity" NUMERIC(19,6) NOT NULL DEFAULT 0,
  "cumulativeRealizedPnl" NUMERIC(19,6) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "orderLogs" (
  "logOrderID" UUID PRIMARY KEY,
  "orderID" UUID NOT NULL,
  "portfolioID" UUID NOT NULL,
  "instrumentID" UUID NOT NULL,
  side TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  "timestamp" TIMESTAMP NOT NULL,
  metadata TEXT,
  status TEXT NOT NULL,
  "executionPrice" DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS position_lots (
  "positionLotID" UUID PRIMARY KEY,
  "holdingID" UUID NOT NULL,
  "sourceBuyLogOrderID" UUID NOT NULL,
  "openedAt" TIMESTAMP NOT NULL,
  "originalQuantity" NUMERIC(19,6) NOT NULL,
  "remainingQuantity" NUMERIC(19,6) NOT NULL,
  "unitCost" NUMERIC(19,6) NOT NULL
);

CREATE TABLE IF NOT EXISTS lot_matches (
  "lotMatchID" UUID PRIMARY KEY,
  "sellLogOrderID" UUID NOT NULL,
  "positionLotID" UUID NOT NULL,
  "holdingID" UUID NOT NULL,
  "matchedQuantity" NUMERIC(19,6) NOT NULL,
  "sellUnitPrice" NUMERIC(19,6) NOT NULL,
  "realizedPnlAmount" NUMERIC(19,6) NOT NULL,
  "matchedAt" TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  "listItemID" UUID PRIMARY KEY,
  "portfolioID" UUID NOT NULL,
  "instrumentID" UUID NOT NULL,
  name TEXT
);
