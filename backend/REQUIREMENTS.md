# Backend Requirements

Tooling and access needed to build and run the `backend/` module locally.

## Tooling

| Tool | Version verified | Used for |
|---|---|---|
| JDK | 21+ (tested on 25.0.3) | Building/running the backend — `pom.xml` targets `java.version=21` |
| Maven | via included `./mvnw` wrapper — no separate install needed | Building the backend |
| `psql` (PostgreSQL client) | 18.x | Inspecting the live Supabase schema directly; optional but useful for debugging |

## Required access

- **Supabase project** (existing JAAKD project) — you need:
  - The project URL (`https://<project-ref>.supabase.co`)
  - A **privileged Postgres role** (session-pooler connection string, port 5432) — get this from Supabase dashboard → Project Settings → Database → Connect → **ORM** tab, or generate a dedicated non-superuser role. Never use the anon/publishable key for this backend's DB connection.
  - The database password — Project Settings → Database → **Reset database password** if you don't have it (note: your Supabase account login, e.g. GitHub OAuth, is separate from the DB password).

## Environment variables (`.env`, copy from `.env.example`, git-ignored)

| Variable | Example | Notes |
|---|---|---|
| `SUPABASE_DB_URL` | `jdbc:postgresql://aws-0-<region>.pooler.supabase.com:5432/postgres` | Must start with `jdbc:`; use the **session pooler** (port 5432), not the transaction pooler (6543) — Hibernate needs persistent connections |
| `SUPABASE_DB_USER` | `postgres.<project-ref>` | The privileged role, not the anon key |
| `SUPABASE_DB_PASSWORD` | — | The database password (see above) |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | Used to fetch the JWKS for validating client-supplied JWTs |

## Known gotchas

- `me.paulschwarz:spring-dotenv` does **not** work with this project's Spring Boot version (4.1.1) — do not re-add it. `.env` loading is handled natively via `spring.config.import: optional:file:.env[.properties]` in `application.yaml`.
- `.env` is git-ignored via the root `.gitignore` (`.env`, `.env.*`, with `!.env.example` explicitly un-ignored) — never put real secrets in `.env.example`.
