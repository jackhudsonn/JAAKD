# JAAKD

Direct-to-consumer trading platform workspace.

## Run locally

### Prerequisites

- Docker host with `docker-compose` available.
- Node.js/npm on your frontend development machine.

### 1) Configure environment

```bash
cp .env.example .env
```

Fill all required values in `.env`:

- `POSTGRES_PASSWORD`
- `JAAKD_APP_DB_PASSWORD`

Use a different long random value for each, e.g. run `openssl rand -hex 32` on the Docker host once per value. Never commit `.env`.

### 2) Start backend stack

```bash
docker-compose up -d --build
```

This starts:

- `jaakd-postgres` on `127.0.0.1:5433`
- `jaakd-backend` on `:8081`

### 3) Start frontend

```bash
cd frontend
npm ci
npx ng serve
```

Open `http://localhost:4200`.

### Stop or reset

- `docker-compose down` stops everything and keeps your data.
- `docker-compose down -v` also deletes the local database. Needed after changing `backend/db/init/` or the DB passwords in `.env`, then run `docker-compose up -d --build` again.
