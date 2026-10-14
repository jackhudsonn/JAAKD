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

-- Seed a development-only auditor account for local testing.
-- userType: 2 = AUDITOR (see UserType enum)
INSERT INTO users ("userID", email, roles)
VALUES (
  '7d01f6ba-39bf-4f09-b6f8-4adcaef2f7f4',
  'auditor@123.com',
  '{AUDITOR}'
)
ON CONFLICT ("userID") DO UPDATE
SET
  email = EXCLUDED.email,
  roles = EXCLUDED.roles;

INSERT INTO profiles (
  "userID",
  "userType",
  "firstName",
  "lastName",
  city,
  state,
  country,
  "zipCode",
  username,
  avatar
)
VALUES (
  '7d01f6ba-39bf-4f09-b6f8-4adcaef2f7f4',
  2,
  'Dev',
  'Auditor',
  'Austin',
  'TX',
  'US',
  '73301',
  'dev_auditor',
  NULL
)
ON CONFLICT ("userID") DO UPDATE
SET
  "userType" = EXCLUDED."userType",
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  country = EXCLUDED.country,
  "zipCode" = EXCLUDED."zipCode",
  username = EXCLUDED.username,
  avatar = EXCLUDED.avatar;

INSERT INTO development_credentials ("userID", email, "passwordHash")
VALUES (
  '7d01f6ba-39bf-4f09-b6f8-4adcaef2f7f4',
  'auditor@123.com',
  crypt('12345678', gen_salt('bf'))
)
ON CONFLICT (email) DO UPDATE
SET
  "userID" = EXCLUDED."userID",
  "passwordHash" = EXCLUDED."passwordHash";
