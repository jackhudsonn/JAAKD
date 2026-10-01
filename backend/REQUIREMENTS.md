# Backend Requirements

Tooling and access needed to build and run `backend/` locally.

## Tooling

| Tool | Version verified | Used for |
|---|---|---|
| JDK | 21+ (tested on 25.0.3) | Build and run backend |
| Maven | via `./mvnw` | Build/test lifecycle |
| Docker + docker-compose | current | Full local stack (Postgres + backend) |

## Required environment variables

For containerized local runs, copy root `.env.example` to `.env` and set:

- `POSTGRES_PASSWORD`
- `JAAKD_APP_DB_PASSWORD`

For running backend directly (without Docker), use `backend/.env.example` as template.

## Known gotchas

- `spring-dotenv` is not used; env loading is configured via Spring `spring.config.import`.
- Never commit real secrets into `.env` files.
- OpenAPI client generation uses the pinned local spec at `backend/openapi/scrumtuous-api.json`.
