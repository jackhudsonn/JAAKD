# JAAKD

Direct-to-consumer trading platform workspace.

## Run locally

The whole application runs in Docker: the frontend dev server, backend, database, and Kafka.

### Prerequisites

- A Docker host with `docker-compose` available.
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

### 2) Start the stack (on the Docker host)

```bash
docker-compose up -d --build
```

This starts:

- `jaakd-postgres` on `127.0.0.1:5433` (reachable only from the Docker host itself)
- `jaakd-backend` on port `8081`
- `jaakd-kafka` on `:9092`
- `jaakd-frontend` on port `4200`

The containers keep running until you stop them. Run the same command again after pulling backend changes.

- `docker-compose ps` shows what is running.
- `docker-compose logs --tail=40 jaakd-backend` shows recent backend logs.
- `docker-compose logs --tail=40 jaakd-frontend` shows the development server output.

### 3) Forward the frontend port (only if Docker runs on another machine)

The frontend calls the backend at the same origin, and the dev server proxies `/api` and `/auth` to the backend container. So the browser only needs the frontend port. Forward it from your machine and leave the terminal open:

```bash
ssh -N -L 4200:localhost:4200 <user>@<host>
```

It asks for a password if needed, then shows nothing while the tunnel is open.

If you have a VS Code Remote-SSH window open to the Docker host, it forwards ports automatically and you can skip the tunnel. Check its Ports tab for `4200`.

### 4) Open the application

Open `http://localhost:4200` and register an account.

Always use `localhost` in the browser, not the host's IP address: sign-in uses a session cookie that is only sent when the frontend and backend are both on `localhost`.

Backend API docs are at `http://localhost:8081/swagger-ui.html`. The tunnel in step 3 forwards only `4200`; to reach the docs, forward the backend port as well:

```bash
ssh -N -L 4200:localhost:4200 -L 8081:localhost:8081 <user>@<host>
```

### Add a frontend dependency

Frontend dependencies live in a Docker volume, not in your working copy. Install inside the running container. `/app` is mounted from the host, so this updates `package.json` and `package-lock.json` on the host:

```bash
docker exec -it jaakd-frontend npm install <package>
```

### Accounts

Sign-in uses the development identity provider, so accounts exist only in your local database. After `docker-compose down -v`, register again.

### Stop or reset

- `docker-compose down` stops everything and keeps your data.
- `docker-compose down -v` also deletes the local database and the frontend dependency volume. Needed after changes under `backend/db/init/` or to the passwords in `.env`. Then run `docker-compose up -d --build` again.
- To reset only the frontend dependencies, without dropping the database: `docker volume rm jaakd-frontend-node-modules`.

### Troubleshooting

- **The app can't reach the backend:** the frontend container or the tunnel isn't running (step 3).
- **The frontend fails to start after a dependency change:** reset the dependency volume (`docker volume rm jaakd-frontend-node-modules`) and run `docker-compose up -d --build` again.
- **`jaakd-backend` isn't "Up" in `docker-compose ps`:** check `docker-compose logs --tail=40 jaakd-backend`.
