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

### Prerequisites

- Docker host with `docker-compose` available.
- If Docker runs on another machine, SSH access to that host.
- Node.js/npm on your frontend development machine.

### 1) Configure environment

```bash
cp .env.example .env
```

Fill all required values in `.env`:

- `POSTGRES_PASSWORD`
- `JAAKD_APP_DB_PASSWORD`
- `JAAKD_AUTH_DB_PASSWORD`
- `JWT_SECRET`

Use a different long random value for each, e.g. run `openssl rand -hex 32` on the Docker host once per value. `JWT_SECRET` must be at least 32 characters. Never commit `.env`.

### 2) Start backend stack

```bash
docker-compose up -d --build
```

This starts:

- `jaakd-postgres` on `127.0.0.1:5433`
- `jaakd-auth` on `:3000`
- `jaakd-backend` on `:8081`
- `jaakd-kafka` on `:9092`

### 3) Run integration checks (optional)

```bash
bash scripts/integration-test.sh
```

The script verifies auth + backend endpoints and confirms user/profile rows in Postgres.


### 4) Start frontend

```bash
cd frontend
npm ci
npx ng serve
```

Open `http://localhost:4200`.

API docs: backend at `http://localhost:8081/swagger-ui.html`, auth service at `http://localhost:3000/api`.

### If Docker runs on another host (e.g. the Linux Docker host from the Windows VM)

Use this tunnel command from your frontend machine so local URLs still work:

```bash
ssh -N -L 3000:localhost:3000 -L 8081:localhost:8081 <user>@<host>
```

Run this in its own terminal on the frontend machine before step 4 and leave it open. It asks for the host password, then shows nothing.

Notes for Linux VM + Windows frontend setup:

- No Kafka tunnel is required for normal app usage or lifecycle-page Kafka validation.
- Backend reaches Kafka through Docker networking (`jaakd-kafka:9092`) inside the VM.
- Add `-L 9092:localhost:9092` only if you want host-side Kafka diagnostics tools from Windows.

### Important migration note

After pulling this change, create a new account. Older Supabase-based accounts do not carry over to this local stack.

### Stop or reset

- `docker-compose down` stops everything and keeps your data.
- `docker-compose down -v` also deletes the local database. Needed after changing `backend/db/init/` or the DB passwords in `.env`, then run `docker-compose up -d --build` again.
- An old `backend/.env` with `SUPABASE_*` values is no longer used and can be deleted.

### Browse the database (pgAdmin)

Postgres only listens on the Docker host's `127.0.0.1:5433`. If Docker runs on another host, add the database port to the tunnel:

```bash
ssh -N -L 3000:localhost:3000 -L 8081:localhost:8081 -L 5433:localhost:5433 <user>@<host>
```

In pgAdmin: **Register > Server**, then on the Connection tab:

- Host `localhost`, port `5433`, database `jaakd`
- Username `jaakd_app` (trading tables) or `jaakd_auth` (`users` table only)
- Password: the matching value from your `.env` (`JAAKD_APP_DB_PASSWORD` or `JAAKD_AUTH_DB_PASSWORD`). Don't save it in pgAdmin or share it.

Each role only sees its own tables, so `jaakd_app` gets "permission denied" on `users`. That is intended. Use pgAdmin to look, not to edit; change data through the app.
