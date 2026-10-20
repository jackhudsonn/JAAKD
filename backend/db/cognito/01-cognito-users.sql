-- Cognito-adapter-owned identity link and registration state.
-- Applied only when identity.provider=cognito; development never creates it.
-- The application userID remains the application's stable identity.

CREATE TABLE IF NOT EXISTS cognito_users (
  "identityID" UUID PRIMARY KEY,
  "userID" UUID NOT NULL UNIQUE REFERENCES users("userID") ON DELETE CASCADE,
  subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED')),
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS cognito_users_email_idx ON cognito_users (email);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cognito_users TO jaakd_app;
