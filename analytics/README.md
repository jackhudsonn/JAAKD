# JAAKD analytics

The data behind the analyst view (`/api/analytics/*`). Every night, a copy job takes the tables analytics needs from the main database, and dbt turns them into daily-history tables ("marts") that the backend reads.

```
jaakd-postgres (jaakd)                     jaakd-analytics-postgres (jaakd_analytics)
  public.* ── copy/copy_raw.py ──────────▶   raw.*                (copy of prod, no personal data)
                                             analytics_staging.*  (dbt views)
                                             analytics.*          (dbt marts) ──▶ backend /api/analytics/*
```

Trading and analytics never share a database. A slow analyst query can't hold up an order, and the analytics database never sees names, emails, birth dates, sessions or payment details.

This README covers running the pipeline locally. The nightly Jenkins job and the Lightsail database aren't set up yet.

## Layout

| Path                  | What it is                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `db/setup.sql`        | Roles, schemas and `raw.*` tables in the analytics database. Safe to rerun.                         |
| `db/init/00-setup.sh` | Runs `setup.sql` with the passwords from `.env`, on the container's first start.                    |
| `copy/copy_raw.py`    | The copy job.                                                                                       |
| `copy/tables.py`      | Which tables and columns are copied.                                                                |
| `dbt/`                | The dbt project. `models/staging` → `models/intermediate` → `models/marts`, plus tests in `tests/`. |
| `requirements.txt`    | Pinned Python packages (psycopg, dbt).                                                              |

## Database roles

| Role                     | Database          | Can do                                                     | Used by                              |
| ------------------------ | ----------------- | ---------------------------------------------------------- | ------------------------------------ |
| `jaakd_analytics_reader` | `jaakd`           | Read-only, and only the tables and columns analytics needs | the copy job (source side)           |
| `analytics_pipeline`     | `jaakd_analytics` | Owns everything                                            | the copy job (destination side), dbt |
| `analytics_app_reader`   | `jaakd_analytics` | Read-only, schema `analytics` only                         | the backend                          |

Passwords come from `.env`: `JAAKD_ANALYTICS_DB_PASSWORD`, `ANALYTICS_PIPELINE_DB_PASSWORD` and `ANALYTICS_DB_PASSWORD`, in that order.

## Run it locally

### 1) Configure `.env` (once)

Set the three passwords above and `COMPOSE_PROFILES=analytics`, so `docker compose up` also starts `jaakd-analytics-postgres`. Postgres creates the roles only when a volume is first initialised. If you set or change these passwords on an existing setup, reset the volumes (`docker compose down -v`) and start again.

### 2) Start the stack and seed it

```bash
docker compose up -d --build
node scripts/seed-demo-users.js
```

The analytics database listens on `127.0.0.1:5434`, and the main database on `127.0.0.1:5433`.

### 3) Fetch price history

The marts need daily prices, and the backend fetches them into `"instrumentPrices"` every night at 22:00 UTC. On a fresh database, trigger the refresh by hand as an admin (the seed script prints the admin login):

```bash
curl -c /tmp/admin.txt -H "Content-Type: application/json" \
  -d '{"email":"<admin email>","password":"<admin password>"}' \
  http://localhost:8081/api/auth/login
curl -b /tmp/admin.txt -X POST http://localhost:8081/api/instruments/prices/refresh
```

It returns `202` and runs in the background (`409` means a refresh is already running). It's finished when the backend logs `Price history refresh ... instruments ok, ... failed, ... rows written`.

**Each refresh makes one Fauxnance call per non-cash instrument.** The API key allows 2000 calls a day, and live trading quotes share that limit, so don't run it in a loop.

### 4) Set up Python (once)

Use Python 3.12. From `analytics/`:

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt          # Windows: .venv\Scripts\pip install -r requirements.txt
source .venv/bin/activate                          # Windows: .venv\Scripts\Activate.ps1
```

### 5) Copy the data

The copy job takes two libpq connection strings from the environment. They aren't in `.env`, so set them in your shell:

```bash
export SOURCE_DSN="host=127.0.0.1 port=5433 dbname=jaakd user=jaakd_analytics_reader password=<JAAKD_ANALYTICS_DB_PASSWORD>"
export ANALYTICS_DSN="host=127.0.0.1 port=5434 dbname=jaakd_analytics user=analytics_pipeline password=<ANALYTICS_PIPELINE_DB_PASSWORD>"
python copy/copy_raw.py
```

In PowerShell, use `$env:SOURCE_DSN = "..."`. Use `127.0.0.1`, not `localhost`: on Windows, `localhost` can hang.

How the copy works:

- All tables come from one consistent snapshot of the source. An order placed mid-copy shows up in every table or in none.
- Everything on the analytics side happens in one transaction, so a failure leaves the previous copy untouched.
- The job logs a row count per table and exits `1` on any failure.

### 6) Build the marts

From `analytics/`:

```bash
dbt build --project-dir dbt --profiles-dir dbt
```

dbt reads `ANALYTICS_PIPELINE_DB_PASSWORD` from the repo's `.env` by itself. Host, port, database and user default to the local container (see `dbt/profiles.yml`). `dbt build` builds every model and runs every test, and it stops on the first failing test.

Always run a full build, or select with `+model+`. A partial `--select` rebuild drops the views downstream of the model, and they stay missing until they're built again.

### 7) Turn on the analyst API

In `.env`, set `ANALYTICS_DB_ENABLED=true`, then `docker compose up -d jaakd-backend`. Until the marts exist, or while the analytics database is down, `/api/analytics/*` returns `503`.

The endpoints need an `ANALYST` (or `ADMIN`) user. To make a local user an analyst:

```sql
UPDATE profiles SET "userType" = 3 WHERE "userID" = '<user id>';
```

Check the build with `GET /api/analytics/meta`, which returns when the source snapshot was taken and when the marts were built.

## Common tasks

### Rerun

Both steps are safe to rerun at any time. The copy replaces every `raw.*` table, and dbt rebuilds every mart from them.

### Reapply `setup.sql` (after editing it)

```bash
docker exec jaakd-analytics-postgres sh /docker-entrypoint-initdb.d/00-setup.sh
```

### Copy a new column or table

1. Add it to the `raw.*` table in `db/setup.sql`, with the same name (quoted camelCase) and type as on the main database, then reapply `setup.sql`.
2. Add it to `copy/tables.py`.
3. Make sure `jaakd_analytics_reader` can read it. It only has the grants in `backend/db/init/01-schema.sql`, so a new table needs a grant there and a migration in `backend/db/migrations/`.
4. Use it from a staging model in `dbt/models/staging/`, and declare it in `_sources.yml`.

Before it changes any data, the copy job compares the source columns, the `raw` columns and `tables.py`. If they disagree, it stops and lists every difference, so a missed step fails loudly instead of copying the wrong data.

Never copy personal data (names, emails, addresses, birth dates, sessions, payment details). Age bands, for example, are computed on the main database (`AGE_BAND_SQL` in `tables.py`), so birth dates never leave it.

### Change a mart

The marts in `dbt/models/marts/` are the contract with the backend. Their column names and types are declared in `_marts.yml` and enforced by dbt, so a model that drifts from them fails the build. When you change one, update the backend's `AnalyticsService` queries and DTOs in the same PR.

### Browse the data

See "Analytics database" in [docs/README.md](../docs/README.md) for pgAdmin.

## Switching to Aurora later

The pipeline uses plain Postgres only, and every connection comes from environment variables, so the switch needs no code changes:

1. Create an Aurora PostgreSQL cluster on the same major version, in the region's default VPC. Turn on Lightsail VPC peering and allow port 5432 from the Lightsail CIDR.
2. Run `db/setup.sql` on it.
3. Point the pipeline's connection (`ANALYTICS_DSN` and the dbt `ANALYTICS_PIPELINE_DB_*` variables) at the Aurora writer, and run the copy and dbt once.
4. Point the backend's `ANALYTICS_DB_URL` at Aurora (the reader endpoint, if there is one), and redeploy.
5. Check `/api/analytics/meta`, then delete the old Lightsail database.
