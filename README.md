# JAAKD

Direct-to-consumer trading platform workspace.

## Run locally

The backend and database run in Docker. The frontend runs with Node on your own machine. They can be on the same machine or different ones.

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

Never commit `.env`. After pulling, compare it with `.env.example` and add any new settings.

Postgres reads these passwords only when it first creates the database. If you change them later, run `docker-compose down -v` and start again (see "Stop or reset").

`backend/.env` is only used when running the backend outside Docker (for example from an IDE). Docker Compose does not read it. To use it, copy `backend/.env.example` and set `SPRING_DATASOURCE_PASSWORD` to the same value as `JAAKD_APP_DB_PASSWORD`.

### 2) Start the backend stack (on the Docker host)

```bash
docker-compose up -d --build
```

This starts:

- `jaakd-postgres` on `127.0.0.1:5433` (reachable only from the Docker host itself)
- `jaakd-backend` on port `8081`

The containers keep running until you stop them. Run the same command again after pulling backend changes.

- `docker-compose ps` shows what is running.
- `docker-compose logs --tail=40 jaakd-backend` shows recent backend logs.

### 3) Forward ports (only if the backend runs on another machine)

If the backend runs on a different machine than the frontend, forward its port from your frontend machine so the default local URLs work. The frontend calls the backend at `http://localhost:8081`, so that port has to reach the Docker host. Run this in its own terminal and leave it open:

```bash
ssh -N -L 8081:localhost:8081 <user>@<host>
```

It asks for a password if needed, then shows nothing while the tunnel is open.

If you have a VS Code Remote-SSH window open to the Docker host, it forwards ports automatically and you can skip the tunnel. Check its Ports tab for `8081`.

Check: `http://localhost:8081/actuator/health` should return `{"status":"UP"}`.

### 4) Start the frontend

```bash
cd frontend
npm install
npx ng serve
```

Open `http://localhost:4200` and register an account. Always use `localhost` in the browser, not the host's IP address: sign-in uses a session cookie that is only sent when the frontend and backend are both on `localhost`.

### Accounts

Sign-in uses the development identity provider, so accounts exist only in your local database. After `docker-compose down -v`, register again.

### Stop or reset

- `docker-compose down` stops everything and keeps your data.
- `docker-compose down -v` also deletes the local database. Needed after changes under `backend/db/init/` or to the passwords in `.env`. Then run `docker-compose up -d --build` again.

### Troubleshooting

- **The app can't reach the backend:** the tunnel isn't running (step 3).
- **`jaakd-backend` isn't "Up" in `docker-compose ps`:** check `docker-compose logs --tail=40 jaakd-backend`.
