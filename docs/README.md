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
- Limit order fills
- Partial fills

Use trades to track changes to holdings, cost basis, and realized/unrealized P&L.

## Architecture

### Backend

Spring Boot API backend for JAAKD.

- The Angular frontend authenticates against the backend and receives an HttpOnly session cookie; it never holds a token.
- The backend owns sessions and talks to the configured identity provider. Only the `development` provider is implemented today; the seam is in place for others.
- Backend connects to our PostgreSQL database using the `jaakd_app` role.
- Trading/profile data is served only through backend REST APIs.

### Frontend

Angular frontend for JAAKD.

- Authentication calls the backend (`http://localhost:8081`).
- Trading/profile APIs call the same backend.
- The interceptor sends requests with credentials; the backend session cookie authorizes them. No token is held in the browser.
- Some dashboard widgets still read from `src/app/core/mocks/mock-data.ts` and are replaced incrementally.

## Development setup

Running the backend outside Docker uses a separate `backend/.env` (loaded by `spring.config.import`), because a host process reaches Postgres on `localhost:5433` rather than the compose service name.

### Backend (without Docker)

```powershell
copy .env.example .env
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

### Browsing the database (pgAdmin)

pgAdmin opens its own SSH tunnel to the Docker host. In pgAdmin: **Register > Server**, then:

- **SSH Tunnel** tab: turn on **Use SSH tunneling**. Tunnel host `<host>`, port `22`, your SSH username and login.
- **Connection** tab: Host `<host>`, port `5433`, maintenance database `jaakd`, username `jaakd_app`.
- Password: the `JAAKD_APP_DB_PASSWORD` value from the Docker host's `.env`. Don't share it.

Tables are under **Databases > jaakd > Schemas > public > Tables**. `jaakd_app` owns the application tables, so it can read them for inspection. Use pgAdmin to look, not to edit; change data through the app.

## Configuration

### Docker (compose)

`docker-compose.yml` reads the two secrets from the root `.env`:

- `POSTGRES_PASSWORD` — Postgres superuser password.
- `JAAKD_APP_DB_PASSWORD` — application-role password.

Everything else is fixed in `docker-compose.yml` and can't be set from `.env`: the database `jaakd`, the role `jaakd_app`, the published Postgres port `5433`, the backend's datasource URL on the internal network, and `IDENTITY_PROVIDER` / `AUTH_COOKIE_SECURE`.

### Local (backend without Docker)

The backend loads `backend/.env` via `spring.config.import`; container environment variables override it. Because the process runs on the host, it must be told where Postgres is:

- `SPRING_DATASOURCE_URL` (e.g. `jdbc:postgresql://localhost:5433/jaakd`)
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `IDENTITY_PROVIDER` (only `development` is implemented)
- `AUTH_COOKIE_SECURE` (required; `true` behind HTTPS, `false` for local HTTP)

### Frontend environment

Frontend environment files define:

- `apiUrl` (backend)
- `authUrl` (backend auth endpoints)

## Backend

API docs: `http://localhost:8081/swagger-ui.html`.

### Useful commands

```powershell
./mvnw test
./mvnw clean package -DskipTests
java -jar target\backend-0.0.1-SNAPSHOT.jar
```

### Notes

- The authenticated user's ID, resolved from the session, maps directly to `profiles.userID`.
- `/actuator/**` is public; `/api/**` requires authentication.
- Schema source of truth is `backend/db/init/` and the JPA model.

## Needs improvement

- The datasource is configured differently per path. On the host, `backend/.env` supplies `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD`. In the compose path those same values are literals in `docker-compose.yml`, so `.env` can only change the passwords. Interpolating them with defaults (`${POSTGRES_DB:-jaakd}`, `${JAAKD_DB_PORT:-5433}`) would let both paths read from one place; until then, changing them means editing `docker-compose.yml`.
