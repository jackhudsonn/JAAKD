# Configuration and Secrets — Design Notes

Follows `05-identity-provider-seam-notes.md`. The backend owns sessions and the
application role `jaakd_app` is established by the init scripts, not by Java.
This note covers how the stack's configuration is supplied — the datasource in
particular — and how secrets should be handled once the project moves past
local development.

Status: documented only. `docker-compose.yml` is deliberately unchanged; the
gap is recorded under "Needs improvement" in `docs/README.md` so it can be
resolved later. An incoming pull request touches the same area, so this note
holds the reasoning rather than the edit.

## The problem

`SPRING_DATASOURCE_*` is partially configurable. The backend reads a full URL,
username, and password from the environment, and `backend/.env` supplies all
three when it runs on the host. In the compose path the URL and username are
literals in `docker-compose.yml`, so the root `.env` can only change the
passwords. Documentation that lists `SPRING_DATASOURCE_URL` and
`SPRING_DATASOURCE_USERNAME` as configuration was therefore misleading: the
container path ignores them.

## Current state

- Root `.env` → Compose interpolation → `POSTGRES_PASSWORD`,
  `JAAKD_APP_DB_PASSWORD` only.
- `backend/.env` → Spring `spring.config.import` → full datasource plus
  `IDENTITY_PROVIDER` / `AUTH_COOKIE_SECURE` (host path).
- Literals in `docker-compose.yml`: database `jaakd`, role `jaakd_app`,
  published port `5433`, container port `5432`, the internal datasource URL,
  `IDENTITY_PROVIDER`, `AUTH_COOKIE_SECURE`.
- Fixtures in `backend/db/init/` and `backend/db/development/`: the role
  `jaakd_app` and the schema.

## The principle

- A value is either **configuration** or a **fixture**. The role name and the
  schema are fixtures — they live in DDL and cannot be set from an env file.
  Exposing them as configuration would let an override silently disagree with
  the database.
- There is **one values file per run path**. Root `.env` configures the compose
  stack; `backend/.env` configures the host run. They cannot merge, because the
  datasource host differs (service name versus `localhost`) and the variable
  names differ (`JAAKD_APP_DB_PASSWORD` versus `SPRING_DATASOURCE_PASSWORD`).
- Configuration that is not surfaced stays a literal in the compose file, which
  is honest as long as the docs say so.

## Decisions

- Keep the v1 CLI (`docker-compose`) for now.
- `.env` is the values file for local configuration. Plaintext is accepted for
  local development; `.env` is gitignored, so values are not committed.
- The database name and role stay fixed in compose. The role is a fixture
  regardless; the database name is also coupled to the init volume, which only
  runs on an empty database.
- The backend port `8081` stays fixed. The frontend environment files and CORS
  assume it, so exposing it would be a footgun rather than a knob.
- Do not parameterize `docker-compose.yml` yet. Record the gap instead.

## Options considered

- **All or none.** Either expose every datasource value (host, port, database,
  role, password) or none. "All" requires templating the init SQL, since the
  role name appears in DDL; "none" means fixing the values and documenting them
  as such.
- **Interpolate with defaults.** Wrap the compose literals as
  `${VAR:-default}` (for example `${POSTGRES_DB:-jaakd}`,
  `${JAAKD_DB_PORT:-5433}`). Cheap, preserves current behavior, and makes
  `.env` the single place. Deferred, not rejected.
- **Override file** (`docker-compose.override.yml`). Good for structural
  deviations — a changed publish port, an extra service. It is normally
  committed, so it is the wrong place for plaintext secrets.
- **File-based secrets.** The production route; see below.

The three value mechanisms answer different questions and stack rather than
compete: `.env` for values, the override file for structure, files for secrets.

## Production direction

- Mount secrets as files (`/run/secrets/...`) instead of environment variables.
- Postgres reads `POSTGRES_PASSWORD_FILE` natively. The application-role
  password needs a shim in two places: `backend/db/init/00-create-roles.sh` and
  a backend entrypoint that exports `SPRING_DATASOURCE_PASSWORD` from its file,
  since Spring has no `_FILE` convention.
- Never pass a secret on a command line. `docker run -e VAR=$SECRET` expands
  into `argv`, visible to any user via `ps`; the compose interpolation path
  avoids this by setting the container environment through the Docker API.
- If the CLI moves to Compose v2 (`docker compose`), the `secrets:` key becomes
  available for `up` and the bind mounts can be replaced.

## Pointer

- `docs/README.md` → "Needs improvement" records the compose parameterization
  gap in one line, for whoever picks it up.
