# JAAKD Backend

Spring Boot API backend for JAAKD.

## Current architecture

- Angular frontend obtains JWTs from `auth-service`.
- Backend validates HS256 JWTs locally using `JWT_SECRET`.
- Backend connects to our PostgreSQL database using the `jaakd_app` role.
- Trading/profile data is served only through backend REST APIs.

## Runtime config

The backend reads env values from `backend/.env` (or container env variables):

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `JWT_SECRET`

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

- JWT `sub` maps directly to `profiles.userID`.
- `/actuator/**` is public; `/api/**` requires authentication.
- Schema source of truth is `backend/db/init/` and the JPA model.
