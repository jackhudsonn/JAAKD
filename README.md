# JAAKD

Direct-to-consumer trading platform workspace.

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

## Run locally

The backend and database run in Docker. The frontend runs with Node on your own machine. They can be on different machines, for example Docker on the shared Linux host and the frontend on the Windows VM.

### Prerequisites

- A Docker host with `docker-compose` available.
- Node.js and npm on the machine where you run the frontend.
- SSH access to the Docker host, if it is a different machine.

### 1) Configure environment (once, on the Docker host)

```bash
cp .env.example .env
```

Set both values in `.env`, using a different long random value for each (generate one with `openssl rand -hex 32`):

- `POSTGRES_PASSWORD`
- `JAAKD_APP_DB_PASSWORD`

Never commit `.env`. It is not tracked by git, so `git pull` never updates it: after pulling, compare it with `.env.example` and add any new settings.

Postgres reads these passwords only when it first creates the database. If you change them later, run `docker-compose down -v` and start again (see "Stop or reset").

`backend/.env` is only used when running the backend outside Docker (for example from an IDE). Docker Compose does not read it. To use it, copy `backend/.env.example` and set `SPRING_DATASOURCE_PASSWORD` to the same value as `JAAKD_APP_DB_PASSWORD`.

### 2) Start the backend stack (on the Docker host)

```bash
docker-compose up -d --build
```

This starts:

- `jaakd-postgres` on `127.0.0.1:5433`
- `jaakd-backend` on `:8081`
- `jaakd-kafka` on `:9092`

### 3) Run integration checks (optional)
- `jaakd-postgres` on `127.0.0.1:5433` (reachable only from the Docker host itself)
- `jaakd-backend` on port `8081`

The containers keep running until you stop them. Run the same command again after pulling backend changes.

- `docker-compose ps` shows what is running.
- `docker-compose logs --tail=40 jaakd-backend` shows recent backend logs.

### 3) Forward ports (only if Docker runs on another machine)

The frontend calls the backend at `http://localhost:8081`, so that port has to reach the Docker host. On the frontend machine, run this in its own terminal and leave it open:

```bash
ssh -N -L 8081:localhost:8081 <user>@<host>
```

It asks for a password if needed, then shows nothing while the tunnel is open. Check its Ports tab for 8081.


### 4) Start frontend

If you have a VS Code Remote-SSH window open to the Docker host, it forwards ports automatically and you can skip the tunnel. Check its Ports tab for `8081`.

Check: `http://localhost:8081/actuator/health` should return `{"status":"UP"}`.

### 4) Start the frontend

```bash
cd frontend
npm ci
npx ng serve
```

`npm ci` is only needed the first time and after `package-lock.json` changes.

Open `http://localhost:4200` and register an account. Always use `localhost` in the browser, not the host's IP address: sign-in uses a session cookie that is only sent when the frontend and backend are both on `localhost`.

API docs: `http://localhost:8081/swagger-ui.html`.

### 5) Run integration checks (optional, on the Docker host)

```bash
bash scripts/integration-test.sh
```

The script registers a test user, checks the auth and backend endpoints, and confirms the matching rows in Postgres.

Notes for Linux VM + Windows frontend setup:

- No Kafka tunnel is required for normal app usage or lifecycle-page Kafka validation.
- Backend reaches Kafka through Docker networking (`jaakd-kafka:9092`) inside the VM.
- Add `-L 9092:localhost:9092` only if you want host-side Kafka diagnostics tools from Windows.

### Accounts

Sign-in uses the development identity provider, so accounts exist only in your local database. After `docker-compose down -v`, register again.

### Stop or reset

- `docker-compose down` stops everything and keeps your data.
- `docker-compose down -v` also deletes the local database. Needed after changes under `backend/db/init/` or to the passwords in `.env`. Then run `docker-compose up -d --build` again.

### Browse the database (pgAdmin)

pgAdmin opens its own SSH tunnel to the Docker host. In pgAdmin: **Register > Server**, then:

- **SSH Tunnel** tab: turn on **Use SSH tunneling**. Tunnel host `10.23.143.42`, port `22`, your SSH username and login.
- **Connection** tab: Host `10.23.143.42`, port `5433`, maintenance database `jaakd`, username `jaakd_app`.
- Password: the `JAAKD_APP_DB_PASSWORD` value from the Docker host's `.env`. Don't share it.
Tables are under **Databases > jaakd > Schemas > public > Tables**. `jaakd_app` owns the application tables, so it can read them for inspection. Use pgAdmin to look, not to edit; change data through the app.

### Troubleshooting

- **The app can't reach the backend:** the tunnel isn't running (step 3).
- **pgAdmin shows "server closed the connection unexpectedly":** on the Connection tab, use Host `10.23.143.42` and port `5433`, not `localhost` or `127.0.0.1`.
- **`jaakd-backend` isn't "Up" in `docker-compose ps`:** check `docker-compose logs --tail=40 jaakd-backend`.
