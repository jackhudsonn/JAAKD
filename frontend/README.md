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

- Authentication calls the backend (`http://localhost:8081`).
- Trading/profile APIs call the same backend.
- The interceptor sends requests with credentials; the backend session cookie authorizes them. No token is held in the browser.

## Environment

Frontend environment files define:

- `apiUrl` (backend)
- `authUrl` (backend auth endpoints)

## Current mock data

Some dashboard widgets still read from `src/app/core/mocks/mock-data.ts` and are replaced incrementally.
