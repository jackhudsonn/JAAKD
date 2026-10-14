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

- Authentication calls the backend under `/api/auth`.
- Trading/profile APIs call the backend under `/api`.
- The browser calls its own origin; the server in front (the dev-server proxy, or nginx for a deployed build) forwards `/api` to the backend. See "Frontend environment".
- The interceptor sends requests with credentials; the backend session cookie authorizes them. No token is held in the browser.
- Some dashboard widgets still read from `src/app/core/mocks/mock-data.ts` and are replaced incrementally.

## Development setup

The backend is expected to run in Docker, where Compose supplies its configuration as environment variables. Running it on the host is a convenience: `spring.config.import` reads the `.env` in the project directory for `IDENTITY_PROVIDER` and `AUTH_COOKIE_SECURE`, and the run environment supplies the datasource, because a host process reaches Postgres on `localhost:5433` rather than the compose service name.

### Backend (without Docker)

The `.env` in the project directory must exist. `spring-boot:run` reads it for `IDENTITY_PROVIDER` and `AUTH_COOKIE_SECURE`; set `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD` in the run environment (`jdbc:postgresql://localhost:5433/jaakd`, `jaakd_app`, and the `JAAKD_APP_DB_PASSWORD` value).

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

### Browsing the database (pgAdmin)

pgAdmin opens its own SSH tunnel to the Docker host. In pgAdmin: **Register > Server**, then:

- **SSH Tunnel** tab: turn on **Use SSH tunneling**. Tunnel host `<host>`, port `22`, your SSH username and login.
- **Connection** tab: Host `<host>`, port `5433`, maintenance database `jaakd`, username `jaakd_app`.
- Password: the `JAAKD_APP_DB_PASSWORD` value from the Docker host's `.env`. Don't share it.

Tables are under **Databases > jaakd > Schemas > public > Tables**. `jaakd_app` owns the application tables, so it can read them for inspection. Use pgAdmin to look, not to edit; change data through the app.

## Configuration

### Docker (compose)

`.env` is the single values file:

- `POSTGRES_PASSWORD` — the Postgres superuser password.
- `JAAKD_APP_DB_PASSWORD` — the application-role password.
- `IDENTITY_PROVIDER` — the identity provider adapter. Only `development` is implemented today.
- `AUTH_COOKIE_SECURE` — whether the session cookie is sent only over HTTPS.

Everything else is fixed in `docker-compose.yml` and can't be set from `.env`: the database `jaakd`, the role `jaakd_app`, the published Postgres port `5433`, and the backend's datasource URL and username on the internal network.

### Local (backend without Docker)

The backend loads the `.env` in the project directory via `spring.config.import`; container environment variables override it. Because the process runs on the host, the datasource must be supplied in the run environment:

- `SPRING_DATASOURCE_URL` (e.g. `jdbc:postgresql://localhost:5433/jaakd`)
- `SPRING_DATASOURCE_USERNAME` (`jaakd_app`)
- `SPRING_DATASOURCE_PASSWORD` (the `JAAKD_APP_DB_PASSWORD` value)

`IDENTITY_PROVIDER` and `AUTH_COOKIE_SECURE` are read from `.env`.

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

## Needs improvement

- `application.yaml` does not distinguish configurable from fixed values: `IDENTITY_PROVIDER` and `AUTH_COOKIE_SECURE` are genuine deployment choices, while `server.port`, the session TTL, and the CORS default are assumed by the frontend and by source. Separating the two is a follow-up.
