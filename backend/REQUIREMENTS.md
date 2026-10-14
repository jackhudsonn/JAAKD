# Backend Requirements

Tooling and access needed to build and run `backend/` locally.

## Tooling

| Tool                    | Version verified       | Used for                              |
| ----------------------- | ---------------------- | ------------------------------------- |
| JDK                     | 21+ (tested on 25.0.3) | Build and run backend                 |
| Maven                   | via `./mvnw`           | Build/test lifecycle                  |
| Docker + docker-compose | current                | Full local stack (Postgres + backend) |

## Required environment variables

`.env` in the project directory is the single values file:

- `POSTGRES_PASSWORD`
- `JAAKD_APP_DB_PASSWORD`
- `IDENTITY_PROVIDER`
- `AUTH_COOKIE_SECURE`

When running the backend on the host (without Docker), the `.env` import supplies `IDENTITY_PROVIDER` and `AUTH_COOKIE_SECURE`; set `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD` in the run environment.

## Known gotchas

- `spring-dotenv` is not used; env loading is configured via Spring `spring.config.import`.
- Never commit real secrets into `.env` files.
- OpenAPI client generation uses the pinned local spec at `backend/openapi/scrumtuous-api.json`.
