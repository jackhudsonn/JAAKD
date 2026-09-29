# JAAKD

Direct-to-consumer trading platform workspace.

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
