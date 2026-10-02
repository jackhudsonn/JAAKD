# JAAKD Backend

Spring Boot API backend for JAAKD.

## Current architecture

- The Angular frontend authenticates against the backend and receives an HttpOnly session cookie; it never holds a token.
- The backend owns sessions and talks to the configured identity provider. Only the `development` provider is implemented today; the seam is in place for others.
- Backend connects to our PostgreSQL database using the `jaakd_app` role.
- Trading/profile data is served only through backend REST APIs.

## Runtime config

The backend loads `backend/.env` via `spring.config.import`; container environment variables override it:

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `IDENTITY_PROVIDER` (only `development` is implemented)
- `AUTH_COOKIE_SECURE` (required; `true` behind HTTPS, `false` for local HTTP)

## Run locally (without Docker)

```powershell
copy .env.example .env
./mvnw spring-boot:run
```

Health check:

```text
http://localhost:8081/actuator/health
```

## Useful commands

```powershell
./mvnw test
./mvnw clean package -DskipTests
java -jar target\backend-0.0.1-SNAPSHOT.jar
```

## Notes

- The authenticated user's ID, resolved from the session, maps directly to `profiles.userID`.
- `/actuator/**` is public; `/api/**` requires authentication.
- Schema source of truth is `backend/db/init/` and the JPA model.
