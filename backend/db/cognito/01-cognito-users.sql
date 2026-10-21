-- Existing-database migration for cognito_users.
-- New databases create this table in backend/db/init/01-schema.sql; the table is
-- present in every environment so switching IDENTITY_PROVIDER needs no migration.
-- Apply this idempotent file once to a database created before that change.

CREATE TABLE IF NOT EXISTS cognito_users (
  "identityID" UUID PRIMARY KEY,
  "userID" UUID NOT NULL UNIQUE REFERENCES users("userID") ON DELETE CASCADE,
  subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED')),
  "signUpSession" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMP
);

ALTER TABLE cognito_users
  ADD COLUMN IF NOT EXISTS "signUpSession" TEXT;

CREATE INDEX IF NOT EXISTS cognito_users_email_idx ON cognito_users (email);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cognito_users TO jaakd_app;
