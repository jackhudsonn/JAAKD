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

### 2) Start backend stack

```bash
docker-compose up -d --build
```

This starts:

- `jaakd-postgres` on `127.0.0.1:5433`
- `jaakd-auth` on `:3000`
- `jaakd-backend` on `:8081`

### 3) Run integration checks

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

### If Docker runs on another host

Use this tunnel command from your frontend machine so local URLs still work:

```bash
ssh -N -L 3000:localhost:3000 -L 8081:localhost:8081 <user>@<host>
```

### Important migration note

After pulling this change, create a new account. Older Supabase-based accounts do not carry over to this local stack.
