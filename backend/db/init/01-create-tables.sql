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
  "currentQuantity" DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS "orderLogs" (
  "logOrderID" UUID PRIMARY KEY,
  "orderID" UUID NOT NULL,
  "portfolioID" UUID NOT NULL,
  "instrumentID" UUID NOT NULL,
  side TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL,
  metadata TEXT,
  status TEXT NOT NULL,
  "executionPrice" DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS trades (
  "tradeID" UUID PRIMARY KEY,
  "holdingID" UUID NOT NULL,
  "orderLogID" UUID NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  "listItemID" UUID PRIMARY KEY,
  "portfolioID" UUID NOT NULL,
  "instrumentID" UUID NOT NULL,
  name TEXT
);
