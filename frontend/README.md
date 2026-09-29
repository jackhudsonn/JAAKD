# JAAKD Frontend

Angular frontend for JAAKD.

## Run

```bash
npm ci
npx ng serve
```

Open:

```text
http://localhost:4200
```

## Architecture notes

- Authentication calls `auth-service` (`http://localhost:3000`).
- Trading/profile APIs call backend (`http://localhost:8081`).
- Access tokens are sent as Bearer auth headers by the frontend interceptor.

## Environment

Frontend environment files define:

- `apiUrl` (backend)
- `authUrl` (auth-service)

## Current mock data

Some dashboard widgets still read from `src/app/core/mocks/mock-data.ts` and are replaced incrementally.
