-- Development-only credential store for the development identity provider.
-- This file is mounted only in local development; production never creates it,
-- so the application schema stays provider- and environment-neutral.

CREATE TABLE IF NOT EXISTS development_credentials (
  "userID" UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE development_credentials TO jaakd_app;
