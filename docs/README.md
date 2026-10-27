# JAAKD Development

How to work on JAAKD. For the local run, see the [main README](../README.md).

## Members

- Jack Hudson
- Andrew Joffe
- Anika Mahns
- Kyle Erhabor
- Diwakar Sandhu

## Terminology

### Transactions

Transactions represent cash movements in and out of a user's account. They do not affect asset positions. Common transaction types include:

- Deposits (ACH, wire, card top-ups)
- Withdrawals
- Fees
- Dividends
- Interest
- Tax withholdings

Use transactions to track changes to the cash ledger.

### Trades

Trades represent position changes in a security. They are created when an order is executed (fully or partially). Common trade types include:

- Buy
- Sell
- Market order fills
- Partial fills

Use trades to track changes to holdings, cost basis, and realized/unrealized P&L.

## Architecture

### Backend

Spring Boot API backend for JAAKD.

- The Angular frontend authenticates against the backend and receives an HttpOnly session cookie; it never holds a token.
- The backend owns sessions and talks to the configured identity provider. `development` and `cognito` adapters are implemented; the frontend stays provider-blind.
- Backend connects to our PostgreSQL database using the `jaakd_app` role.
- Trading/profile data is served only through backend REST APIs.

### Frontend

Angular frontend for JAAKD.

- Authentication calls the backend under `/api/auth`.
- Trading/profile APIs call the backend under `/api`.
- The browser calls its own origin; the server in front (the dev-server proxy, or nginx for a deployed build) forwards `/api` to the backend. See "Frontend environment".
- The interceptor sends requests with credentials; the backend session cookie authorizes them. No token is held in the browser.
- Some dashboard widgets still read from `src/app/core/mocks/mock-data.ts` and are replaced incrementally.

### Auditor testing environment

The frontend includes an Auditor Lab at `/testing/auditor` for endpoint verification (not production UI polish).

Primary workflows:

- User drilldown: search user -> portfolios/holdings -> holding position lots + lot matches.
- Order-log investigation: day-based search with optional filters and grouped lifecycle timeline.
- Request diagnostics: last called endpoint, params, status code, and rows loaded.

This page uses `/api/audit/**` endpoints and is intended for `AUDITOR` or `ADMIN` users.

## Development setup

The backend is expected to run in Docker, where Compose supplies its configuration as environment variables. Running it on the host is a convenience: `spring.config.import` reads the `.env` in the project directory for `SPRING_PROFILES_ACTIVE`, `IDENTITY_PROVIDER`, and `AUTH_COOKIE_SECURE`, and the run environment supplies the datasource, because a host process reaches Postgres on `localhost:5433` rather than the compose service name. Spring profiles select environment-specific YAML; `IDENTITY_PROVIDER` only selects the authentication adapter.

### Backend (without Docker)

The `.env` in the project directory must exist. `spring-boot:run` reads it for `SPRING_PROFILES_ACTIVE`, `IDENTITY_PROVIDER`, and `AUTH_COOKIE_SECURE`; set `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD` in the run environment (`jdbc:postgresql://localhost:5433/jaakd`, `jaakd_app`, and the `JAAKD_APP_DB_PASSWORD` value).

```powershell
./mvnw spring-boot:run
```

Health check:

```text
http://localhost:8081/actuator/health
```

### Integration checks

```bash
bash scripts/integration-test.sh
```

The script registers a test user, checks the auth and backend endpoints, and confirms the matching rows in Postgres.

### Browsing the database (command line)

The Postgres container includes `psql`:

```bash
docker compose exec -it jaakd-postgres psql -U postgres -d jaakd
```

### Browsing the database (pgAdmin)

pgAdmin opens its own SSH tunnel to the Docker host. In pgAdmin: **Register > Server**, then:

- **SSH Tunnel** tab: turn on **Use SSH tunneling**. Tunnel host `<host>`, port `22`, your SSH username and login.
- **Connection** tab: Host `<host>`, port `5433`, maintenance database `jaakd`, username `jaakd_app`.
- Password: the `JAAKD_APP_DB_PASSWORD` value from the Docker host's `.env`. Don't share it.

Tables are under **Databases > jaakd > Schemas > public > Tables**. `jaakd_app` owns the application tables, so it can read them for inspection. Use pgAdmin to look, not to edit; change data through the app.

#### Analytics database

The analyst view has its own database, `jaakd_analytics`, in the `jaakd-analytics-postgres` container (see `analytics/`). It's an opt-in compose service: set `COMPOSE_PROFILES=analytics` in `.env` so `docker compose up -d --build` starts it with everything else, or start it on its own with `docker compose --profile analytics up -d jaakd-analytics-postgres`. It uses the stock `postgres:18` image, so there's nothing to build. `analytics/db/setup.sql` runs on its first start with an empty volume.

Register a second server the same way, with the same SSH tunnel:

- **Connection** tab: Host `<host>`, port `5434`, maintenance database `jaakd_analytics`, username `analytics_pipeline`.
- **Advanced** tab: DB restriction `jaakd_analytics`.
- Password: the `ANALYTICS_PIPELINE_DB_PASSWORD` value from the Docker host's `.env`.

The tables are **not** in `public`. Look under **Databases > jaakd_analytics > Schemas**:

- `raw`: the nightly copy of the prod tables (filled by `analytics/copy`).
- `analytics_staging`: dbt views.
- `analytics`: the dbt marts the backend reads.

All three are empty until the copy job and dbt have run. If the tree looks stale, right-click **Schemas > Refresh**.

To check what the read-only roles can see, register them as extra servers: `jaakd_analytics_reader` on port `5433` / `jaakd` (password `JAAKD_ANALYTICS_DB_PASSWORD`), and `analytics_app_reader` on port `5434` / `jaakd_analytics` (password `ANALYTICS_DB_PASSWORD`). Quote camelCase names in the Query Tool, e.g. `SELECT * FROM "orderLogs";`.

## Configuration

### Docker (compose)

`.env` is the single values file:

- `POSTGRES_PASSWORD` — the Postgres superuser password.
- `JAAKD_APP_DB_PASSWORD` — the application-role password.
- `IDENTITY_PROVIDER` — the identity provider adapter: `development` or `cognito`.
- `AUTH_COOKIE_SECURE` — whether the session cookie is sent only over HTTPS.
- `JAAKD_ANALYTICS_DB_PASSWORD` — the password for `jaakd_analytics_reader`, the read-only role the analytics copy job uses on `jaakd`. Optional; the role is skipped when it's empty.
- `ANALYTICS_PIPELINE_DB_PASSWORD` — the password for `analytics_pipeline`, which owns the analytics database.
- `ANALYTICS_DB_PASSWORD` — the password for `analytics_app_reader`, the backend's read-only role on the analytics database.
- `COMPOSE_PROFILES=analytics` — includes `jaakd-analytics-postgres` in `docker compose up`.
- `COGNITO_REGION` — the AWS region of the Cognito user pool. Required when `IDENTITY_PROVIDER=cognito`.
- `COGNITO_USER_POOL_ID` — the Cognito user-pool ID. Required when `IDENTITY_PROVIDER=cognito`.
- `COGNITO_CLIENT_ID` — the backend app-client ID. Required when `IDENTITY_PROVIDER=cognito`.
- `COGNITO_CLIENT_SECRET` — the backend app-client secret. Required when `IDENTITY_PROVIDER=cognito`.
- `COGNITO_API_CALL_TIMEOUT` — total time allowed for a Cognito API call, as an ISO-8601 duration (default `PT10S`).
- `COGNITO_API_CALL_ATTEMPT_TIMEOUT` — time allowed for each Cognito API retry attempt, as an ISO-8601 duration (default `PT5S`).
- `COGNITO_RETRY_ATTEMPTS` — number of retries for failed Cognito API calls (default `2`).

The AWS-side console setup is in `docs/cognito-setup.md`.

Everything else is fixed in `docker-compose.yml` and can't be set from `.env`: the database `jaakd`, the role `jaakd_app`, the published Postgres port `5433`, and the backend's datasource URL and username on the internal network.

### Local (backend without Docker)

The backend loads the `.env` in the project directory via `spring.config.import`; container environment variables override it. Because the process runs on the host, the datasource must be supplied in the run environment:

- `SPRING_DATASOURCE_URL` (e.g. `jdbc:postgresql://localhost:5433/jaakd`)
- `SPRING_DATASOURCE_USERNAME` (`jaakd_app`)
- `SPRING_DATASOURCE_PASSWORD` (the `JAAKD_APP_DB_PASSWORD` value)

`IDENTITY_PROVIDER`, `AUTH_COOKIE_SECURE`, and the `COGNITO_*` values are read
from `.env` when present.

### Frontend environment

Every environment file sets `apiUrl` to empty, so the frontend calls its own origin. Routing to the backend is the job of whatever serves the frontend, and no host is compiled in. The backend owns `/api/**`; the SPA owns every other path.

- `ng serve` uses `frontend/proxy.conf.js`, which forwards `/api` to `BACKEND_TARGET` (default `http://localhost:8081`; Docker Compose sets it to the backend service name).
- A deployed build is fronted by a reverse proxy. The nginx image in `frontend/Dockerfile` forwards `/api` to `BACKEND_UPSTREAM`.

## Backend

API docs: `http://localhost:8081/swagger-ui.html`.

### Demo user creation

To avoid manually setting up a user account (signing in, adding bank accounts, adding funds, buying/selling instruments, etc) when spinning up a fresh db, run the command below in root. Copy any of the three credentials from your terminal directly. There is a newbie, intermediate, and pro user; the newbie user has a couple of trades and pro has more of a history (many trades, multiple watchlists, etc).

```bash
node scripts/seed-demo-users.js
```

The script requires `IDENTITY_PROVIDER=development` and exits before seeding
otherwise.

### Useful commands

```powershell
./mvnw test
./mvnw clean package -DskipTests
java -jar target\backend-0.0.1-SNAPSHOT.jar
```

### Notes

- The authenticated user's ID, resolved from the session, maps directly to `profiles.userID`.
- `/actuator/**` is public, as are `/api/auth/register` and `/api/auth/login`; the rest of `/api/**` requires authentication.
- Schema source of truth is `backend/db/init/` and the JPA model.
- For existing databases, apply incremental SQL migrations from `backend/db/migrations/` in order.

### Order lifecycle and Kafka events

- Sequence source: `backend/OrderSequenceDiagram.mmd`.
- Submit intake for BUY/SELL now requires a valid quote at submission time:
  - Calls `QuoteService.getExecutionPrice(instrumentId, side)`.
  - Retries up to 3 times when quote is null/non-positive or provider errors.
  - If retries are exhausted, submission fails with `InvalidTradeException` and no order row is saved/published.
- DEPOSIT/WITHDRAW still submit without quote lookup.
- Kafka topology is unchanged:
  - `order-submitted` -> validation -> `order-accepted` or `order-rejected`.
  - `order-accepted` -> execution -> append `EXECUTED` or `FAILED`.
- Runtime faults are handled deterministically in lifecycle services:
  - Validation runtime errors map to `REJECTED` append/publish path.
  - Execution runtime errors append `FAILED`.

### Security error responses

Unauthorized and forbidden responses now follow the shared `ErrorResponse` JSON shape at the security layer (not only controller exception handlers). Practical implications:

- Missing/invalid session returns `401` with message `Unauthorized` and empty `details` object.
- Authenticated-but-forbidden requests return `403` with `ErrorResponse` JSON.
- Some domain exceptions still return `details: null`; OpenAPI reflects that `details` may be object or null.

## Needs improvement

- `application.yaml` does not distinguish configurable from fixed values: `IDENTITY_PROVIDER` and `AUTH_COOKIE_SECURE` are genuine deployment choices, while `server.port`, the session TTL, and the CORS default are assumed by the frontend and by source. Separating the two is a follow-up.
