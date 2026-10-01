# Identity Provider Seam — Design Notes

Follows `04-jwt-signing-key-notes.md`. That note moved token *issuance* to
RS256 + JWKS so the backend verifies with public keys only, and that direction
is now in the code (`auth-service` signs RS256, serves
`/.well-known/jwks.json`; `SecurityConfig.jwtDecoder` verifies by JWK Set URI).

This note covers the next question: how to adopt a managed identity provider
(Amazon Cognito) for production while keeping development self-contained, and
without letting either environment leak into the other.

Status: direction only. No code, config, or schema has changed from this note.

## The principle

- Environments differ in **wiring**, not in **model**.
- The seam between the application and its identity provider is a **port**
  (an interface) the application depends on. **Adapters** implement the port
  per environment, and one configuration point selects the adapter.
- The database stores **application facts only**. It never names a provider,
  an environment, or a credential.
- Development and production use **separate databases**, so a given schema
  never holds two providers' subjects at once and needs no way to tell them
  apart.

This corrects an earlier sketch that added `authProvider` / `passwordHash`
columns to `users`. That put development awareness into the production data
model. An interface replaces it.

## Decisions

- **Layout A** (backend-mediated). The frontend calls the backend; the
  provider seam lives entirely in the backend.
- **Identity is provider-local.** The application takes the provider's subject
  as `userID`, and `sub` is the identity claim. Switching providers therefore
  changes application identities — a migration event, not a runtime concern.
- **Email is authentication-owned.** It lives with the provider (Cognito, or
  the dev issuer's credential store) and reaches the application at sign-in.
- **Full BFF session model.** The browser holds only an opaque session cookie;
  JWTs never reach the frontend and become an internal detail of the backend's
  provider adapters.

## Ports

There are two ports, both on the backend. The frontend depends on neither: it
only calls the backend at a configured URL.

| Port                | Responsibility                                                  | Adapters                          |
| ------------------- | --------------------------------------------------------------- | --------------------------------- |
| `TokenAuthenticator`| Verify an incoming access token and return identity.            | JWKS-backed JWT (dev issuer, Cognito) |
| `IdentityProvider`  | Credential and session operations: register, sign in, refresh, change password, sign out. | dev issuer, Cognito |

The browser path authenticates by session cookie, not by token, so
`TokenAuthenticator` serves only non-browser consumers (a future mobile app, a
service-to-service caller). The browser path uses session resolution instead.

Token verification is already effectively this port (`JwtDecoder` + issuer and
JWK Set URI config) for consumers that do present a token. Making it explicit
gives tests a stub and keeps the core free of provider code.

```java
public interface TokenAuthenticator {
    AuthenticatedUser authenticate(String accessToken);
}

public record AuthenticatedUser(UUID userId, String email, Set<String> roles) {}
```

The core takes **one identity value** from the token and everything else from
its own store. No provider-specific claim reaches the core.

```java
public interface IdentityProvider {
    void register(String email, String password);
    SignInOutcome signIn(String email, String password);
    SignInOutcome respondToChallenge(String continuation, String response);
    Tokens refresh(String refreshToken);
    void changePassword(String accessToken, String currentPassword, String newPassword);
    void signOut(String refreshToken);
}

public sealed interface SignInOutcome {
    record Authenticated(String accessToken, String refreshToken) implements SignInOutcome {}
    record Challenge(String continuation, String type) implements SignInOutcome {}
}
```

`Challenge` is what lets Cognito's multi-step flows (MFA, new password
required, email confirmation) cross the port without the frontend knowing who
produced them.

## Choose a layout

The layouts differ in **where the provider seam lives**. Pick one; the rest of
this note applies to all of them.

> **Pick Layout A** unless you specifically want a hosted login page (B) or
> must ship a provider SDK in the browser today (C).

| | A. Backend-mediated *(recommended)* | B. Generic OIDC redirect | C. Direct-to-provider |
| --- | --- | --- | --- |
| Frontend provider-aware | No | No | **Yes** |
| Backend provider code | One adapter per provider | None (config only) | None |
| Login UI | Your existing inline forms | Provider-hosted page | Provider SDK (Amplify) |
| Dev work | Dev issuer service | Dev issuer service + login page | Dev issuer as OIDC provider |
| Verdict | **Recommended** | Purest; some UX change | Avoid unless required |

### Layout A — Backend-mediated (recommended)

The frontend calls the backend for auth, exactly as it does today. The backend
is the only thing that knows which provider is configured.

- Frontend: `AuthService` posts to `${environment.authUrl}/auth/...`. Only the
  URL varies per environment — the frontend never learns the provider.
- Backend: `IdentityProvider` has a dev adapter (calls the dev issuer) and a
  Cognito adapter (calls the user pool API). Selected by config.
- Preserves current inline login/register forms and the current UX.

Cost: the password transits the backend (TLS, never logged). This is the
normal backend-for-frontend tradeoff.

### Layout B — Generic OIDC redirect

Make both issuers speak OIDC and use **one** backend adapter (a generic OIDC
client, configured with issuer / authorize / token / JWKS URLs). No
provider-specific backend code at all.

- Login redirects to the provider's hosted page, then back with a code.
- The dev issuer must serve a small `/authorize` login page.

Cost: replaces inline forms with a redirect. Choose it only if that UX is
acceptable and you want literally zero provider code.

### Layout C — Direct-to-provider (not recommended)

The frontend embeds the provider's SDK (Amplify) and talks to Cognito directly.
This is the idiomatic Cognito path, but it makes the frontend provider-aware
and forces a second frontend adapter for dev — reintroducing exactly the
environment coupling this design removes. Noted for completeness only.

## Data model

Application schema holds no credentials and names no provider:

```sql
CREATE TABLE IF NOT EXISTS users (
  "userID" UUID PRIMARY KEY,
  roles TEXT[] NOT NULL DEFAULT '{CLIENT}',
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);
```

Email is authentication-owned and is not stored on the anchor. It lives with
the provider and reaches the application at sign-in; where the application
needs its own copy for display, `profiles.email` holds it.

`profiles` and everything below it are unchanged. `users` remains the identity
anchor for the `profiles → users` foreign key; `userID` is the provider's
subject (`sub`), so switching providers changes application identities — a
migration event, not a runtime concern.

Credentials live **with the adapter**:

- Production: Amazon Cognito. The application schema has no credential table.
- Development: the dev issuer's own store, created by the dev issuer's own
  migration and never referenced by application code.

```sql
-- dev-issuer-owned migration; not applied in production
CREATE TABLE IF NOT EXISTS dev_credentials (
  "userID" UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "refreshToken" TEXT
);
```

The two line up because the dev issuer mints the UUID and puts it in the
identity claim; the application provisions its `users` row from that. In
production the identity claim is Cognito's `sub` (or an application UUID the
pool injects). Either way the application stores the value as `userID` and
never asks where it came from.

### Development durability

Persistence is a property of **where state lives**, not of whether the dev
issuer's process keeps running. Containers restart; that is normal, and in
development as in production it is irrelevant when the state is external.

- **Credentials and refresh tokens** persist if the dev issuer writes them to
  Postgres — which the current `auth-service` already does. A service restart
  loses nothing.
- **The signing key** persists only if stored durably. Today it is a mounted
  file (`auth-service/keys`), which survives restarts. A key generated at boot
  does not, and each restart rotates the JWKS, invalidating every previously
  issued token.
- **The process** is not durable by design, and it is the only thing a restart
  loses — and only if state was kept in memory.

So the persistent dev issuer is the default, and it is close to free because
the database and key mount already exist. An in-memory mint is an
**intentional exception** chosen for a disposable clean slate, not a
persistence trade. If chosen, accept that a restart logs everyone out and
rotates the key.

Caveat: Postgres persistence lasts only while the volume does; a
`docker compose down -v` wipes it. Resetting dev data is often desirable, so
treat the volume as disposable on purpose, not by accident. The dev issuer's
store is its own table (above), never the application schema.

**Persisting users while discarding sessions** — the common development target
— needs only:

1. A durable Postgres volume (`docker compose down`, not `-v`).
2. A dev-issuer credential table holding a stable `userID`, email, and
   password hash. The `userID` is minted once at registration and never
   regenerated; the token's identity claim and the application's `users` row
   both key on it.
3. A stable signing key with a **new `kid` every boot**, only if a bearer path
   is retained. Under full BFF the dev adapter returns an identity and no
   client-facing token, so no key or JWKS is needed.
4. Idempotent provisioning: `ensureUser` treats an existing row as a no-op.

Refresh tokens are then the only thing deciding whether a restart ends a
session — persist them to keep sessions, keep them in memory to end them.
Access tokens are never persisted.

## Session model (full BFF)

The browser holds only an opaque session cookie. JWTs never reach the frontend
and are an internal detail of the backend's provider adapters.

- **Sign in.** The backend calls the provider, receives the provider response
  (tokens and email), provisions the application user, writes a session
  (`sessionID`, `userID`, `email`, `expiresAt`, provider refresh token),
  rotates the session id, and sets
  `Set-Cookie: jaakd_session=<id>; HttpOnly; Secure; SameSite=Lax; Path=/`.
  Nothing token-shaped is returned to the browser.
- **API calls.** The browser sends the cookie automatically; a filter resolves
  it to `AuthenticatedUser(userID, email)`. `CurrentUserService` keeps its
  shape and reads the session.
- **Session refresh.** The backend refreshes the provider token or extends the
  session on its own schedule. The browser is not involved and never sees a
  401 caused by token expiry.
- **Sign out.** The backend deletes the session, revokes at the provider, and
  clears the cookie.

What this settles:

- **No JWT on the request path.** Note 04's JWKS machinery is no longer used for
  browser traffic. It remains the provider boundary and the foundation for any
  future non-browser consumer that presents a token.
- **No shared secret and no client-facing key rotation.** The original HS256
  concern is sidestepped rather than solved: no client presents a verifiable
  token, so there is no key for a verifier to hold. The provider's token is
  received by the backend directly over TLS, so its signature is provenance
  rather than a trust boundary; claim validation (`exp`, `iss`, `aud`) still
  belongs.
- **Statefulness is required.** Sessions are the source of truth, and
  horizontal scaling needs shared session storage (a table, not in-memory).

Details to get right:

- CSRF returns, because state-changing requests are cookie-authenticated.
  `SameSite=Lax` plus a CSRF token; the backend currently disables CSRF.
- CORS already permits credentials with exact origins
  (`corsConfigurationSource`), which cookies require.
- Cookies require HTTPS in production; development over plain HTTP needs a
  tunnel or a dev-only relaxed cookie. Cross-*site* dev origins need
  `SameSite=None; Secure`; same-site development avoids it.
- Rotate the session id on sign-in and delete all of a user's sessions on
  password change, to prevent fixation and stale access.
- Session-store durability decides whether a backend restart logs users out:
  in-memory sessions end them, a table preserves them.

If a non-browser client appears later, add a bearer path alongside sessions;
`TokenAuthenticator` already exists for it.

## Backend auth routes

The frontend keeps its shape; `environment.authUrl` points at the backend and
auth calls are sent with credentials. No route returns a token.

- `POST /auth/register` `{ email, password }` → `201`; `409` if taken.
- `POST /auth/login` `{ email, password }` → `200 { email }` plus the session
  cookie; `202 { challenge, continuation }` if the provider returns a
  challenge; `401` otherwise.
- `POST /auth/challenge` `{ continuation, response }` → `200` (as login) or
  `401`.
- `GET /auth/session` (cookie) → `200 { email }` or `401`.
- `POST /auth/logout` (cookie) → `204`, clears the cookie.
- `POST /auth/change-password` (cookie) `{ currentPassword, newPassword }` →
  `204`; `401`.

Session refresh is a backend concern, so there is no client-facing
`/auth/refresh`. Every auth route authenticates by session cookie; the browser
never holds or sends a token.

## Provisioning (shared, provider-agnostic)

Creating the application's `users` row is application logic, not adapter logic,
and is identical in both environments:

```java
@Transactional
public UUID ensureUser(AuthenticatedUser user) {
    return userRepository.findById(user.userId())
            .map(User::getUserId)
            .orElseGet(() -> userRepository.save(new User(user.userId(), user.email())).getUserId());
}
```

It runs once per sign-in, after the provider response is available, so the
email it uses comes from the provider rather than from the access token. It
never sees a password, a provider, or an environment.

## How it looks in action

The frontend stays provider-blind; only the backend differs.

| Flow | Development | Production |
| --- | --- | --- |
| Register | Frontend → backend → dev adapter stores the credential | Frontend → backend → Cognito stores the credential, may send a code |
| Sign in | Frontend → backend → dev adapter checks the credential, backend starts a session | Frontend → backend → Cognito verifies, backend starts a session |
| Authenticated request | Browser sends the session cookie; backend resolves it to the user | Same |
| Provisioning | Backend provisions the application `users` row from the provider response (which carries email) | Same |
| Session refresh | Backend refreshes its own session; browser not involved | Same |
| Change password | Dev adapter updates its store | Cognito `ChangePassword` |
| Sign out | Backend deletes the session | Backend deletes the session |

The environment is chosen once, at wiring. The core runs one path.

## Migration outline from the current state

1. Split the current shared `users` table: keep application facts
   (`userID`, roles, createdAt) in the application schema; move
   `passwordHash` / `refreshToken` into the dev issuer's own store.
2. Grant the backend `INSERT` on the application `users` table (it currently
   cannot write it), so `ensureUser` works.
3. Add the session store and the cookie filter; make `CurrentUserService` read
   the session's `AuthenticatedUser`.
4. Introduce `IdentityProvider` with the dev adapter first; point the frontend
   at the backend for auth instead of calling the dev issuer directly.
5. Add the Cognito adapter and select it by config in production. Do not
   deploy the dev issuer there.
6. Remove the frontend's bearer/refresh handling; keep `TokenAuthenticator`
   only if a non-browser consumer exists.

## The token contract and claim drift

The port's promise is that the core runs one path. **Claim drift** is when the
two issuers' tokens differ in a way the core depends on, so that "one path"
silently behaves differently in production. Under full BFF this contract sits
at the backend↔provider boundary rather than on the request path: the backend
reads identity and email from the provider response at sign-in, so it is still
the place those differences would bite.

The core depends on a deliberately small contract:

- an identity claim it stores as `userID`;
- an email available when it first provisions `users`;
- standard validation: issuer, expiry, and any token-type check (`token_use`,
  `aud` / `client_id`) the validator enforces.

Drift happens on any of these axes:

| Axis | Example | How it closes |
| --- | --- | --- |
| Claim name | Dev uses `sub`; Cognito puts the application UUID in `custom:userId`. | Name claims in configuration (`jwt.user-id-claim`, `jwt.email-claim`) so the difference is a reviewable value, not hidden code. |
| Claim presence | Cognito access tokens omit top-level `email`; the dev issuer includes it. | Decide the email source once; both issuers must satisfy it (pool scope or trigger for Cognito, otherwise resolve from the application store). |
| Claim meaning | Both use `sub`, but dev's is the application UUID and Cognito's is the pool UUID. | Fix the semantics once in the contract; provisioning is the only place that interprets it. |
| Token flags | Cognito emits `token_use` / `client_id`; the dev issuer omits them. | Make the dev issuer emit the same claims so one validator serves both. |
| TTL and skew | Different lifetimes, no tolerance for clock skew. | Set lifetimes and skew by configuration; keep them explicit. |

The dangerous axis is **claim meaning**, because it fails silently: data can be
written under the wrong identity anchor rather than rejected. The others
usually surface as 401s.

A contract test runs tokens from each issuer through the **same**
`TokenAuthenticator` and asserts the same `AuthenticatedUser`:

- *Unit level*: generate tokens locally against the contract (as
  `SecurityConfigTest` already does) and assert the negative cases too — a
  missing identity claim or a malformed UUID must be rejected.
- *Cross-issuer*: an integration test that fetches a real token from the
  configured issuer and runs it through the same authenticator. In development
  this hits the dev issuer; in a staging pipeline it hits a test Cognito pool.

The contract belongs to the application, not to Cognito: the dev token stays
distinct (its own issuer and key), and the test only asserts that each issuer
satisfies what the core requires.

## Failure modes to close

- **Claim drift.** The identity claim and its meaning must match across
  issuers; see "The token contract and claim drift" above.
- **Error shape.** Invalid / expired token must surface as 401 uniformly; the
  core must not see provider-specific exceptions.
- **Capability gaps.** If confirmation or MFA exists only in production,
  model it as an optional capability (`Challenge`) and skip it where absent —
  never as a method the dev adapter silently fakes.
- **Credentials in the schema.** The moment `passwordHash` reappears in the
  application `users` table, the environment has leaked into the model again.

## Why this matters for future agents

- Do not put provider or environment columns in the application schema. The
  seam is a port, not a column.
- Do not add a provider SDK (Amplify) to the frontend while Layout A is in
  effect; the frontend stays provider-blind.
- Do not let the backend sign tokens in development. The dev issuer signs and
  publishes JWKS; the backend only verifies.
- Changing providers is an adapter and configuration change, not a schema
  change. If it starts to require schema changes, the design has drifted.

## Scope note

- This note documents the concern, the port design, and the layout options.
- It does not itself change any code, config, compose file, or migration.
