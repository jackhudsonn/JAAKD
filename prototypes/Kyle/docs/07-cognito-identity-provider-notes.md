# Cognito Identity Provider — Decisions and Execution Plan

Follows `05-identity-provider-seam-notes.md` and `06-configuration-and-secrets-notes.md`.
This note records the decisions for adding Amazon Cognito as a second
`IdentityProvider` adapter, and the plan to execute them.

Status: backend, database, frontend, and tests are implemented. AWS pool and
app-client creation remains an environment step (see `docs/cognito-setup.md`).

## Relationship to 05

05 chose the provider's `sub` as the application `userID`, accepting that a
provider switch would re-key application identities. This note reverses that
decision for Cognito: application users keep an application-generated UUID, and
each provider owns the table that links its identity to that UUID.

This preserves 05's core rule: the application schema stores no provider or
environment columns. Provider-specific state lives with the adapter. Unlike the
generic `external_identities` sketch considered during review, there is no shared
mapping table, and development carries no unused mapping rows.

The browser-facing auth model is unchanged: backend-mediated, server-side
sessions, no token in the browser. The `TokenAuthenticator` path from 04/05
remains unused for browser traffic. The challenge seam remains in the port, but
completing challenges is deferred.

## Decisions at a glance

- Add `CognitoIdentityProvider`, selected by `identity.provider=cognito`.
- Application `users.userID` is an application-generated UUID, not Cognito `sub`.
- Each provider owns its link table. Development keeps using
  `development_credentials`; Cognito gets `cognito_users`.
- No cross-provider user linking is implemented. The stable application ID makes
  it possible later.
- Registration stores PII up front: `users` and `profiles` rows are created
  before email confirmation.
- Registration calls Cognito first, then writes the application rows.
- Email ownership is verified with Cognito's built-in sender and a code entered
  in the application. No SES, no AWS production-access review.
- Login uses Cognito `InitiateAuth` with `USER_PASSWORD_AUTH` and a confidential
  app client.
- ID tokens are verified locally with Cognito's JWKS.
- Logout revokes only that session's Cognito refresh token.
- Password change revokes the other sessions' refresh tokens and deletes those
  sessions; the current session stays.
- Password strength is owned by the provider (the user pool). The application
  keeps only a minimal floor and surfaces Cognito's rejection.
- MFA, challenge completion, and password recovery are deferred.
- Pool recreation is treated as an explicit reset or migration, not a routine
  operation.

## Identity ownership and data model

The application user is the durable identity. The provider identity is
replaceable. All application foreign keys reference `users.userID`.

```sql
-- Application-owned. Unchanged except for how rows are created.
CREATE TABLE IF NOT EXISTS users (
  "userID" UUID PRIMARY KEY,
  email TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{CLIENT}',
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- Application-owned profile. Created during registration, before confirmation.
-- Existing fk_profiles_users is ON DELETE RESTRICT; no change to this table.
CREATE TABLE IF NOT EXISTS profiles (
  "userID" UUID PRIMARY KEY,
  "userType" NUMERIC NOT NULL DEFAULT 0,
  "firstName" TEXT,
  "lastName" TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  "zipCode" TEXT,
  dob DATE,
  username TEXT,
  avatar TEXT
);

-- Development-provider-owned. Already exists and is mounted only in development.
-- "userID" is the application user ID.
CREATE TABLE IF NOT EXISTS development_credentials (
  "userID" UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- Cognito-adapter-owned. Exists only when identity.provider=cognito.
CREATE TABLE IF NOT EXISTS cognito_users (
  "identityID" UUID PRIMARY KEY,
  "userID" UUID NOT NULL UNIQUE REFERENCES users("userID") ON DELETE CASCADE,
  subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  status TEXT NOT NULL, -- PENDING | CONFIRMED
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS cognito_users_email_idx ON cognito_users (email);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cognito_users TO jaakd_app;
```

All primary keys are single UUIDs. `subject` and `userID` are single-column
unique constraints. `email` is indexed but not unique, because an old row can
legitimately retain an address after a change or a re-registration.

`cognito_users` is adapter-owned:

- It is created by a Cognito-only migration, not the base schema.
- It is absent in development, so development does not carry unused state.
- The adapter uses `JdbcTemplate`, not JPA, so Hibernate's `ddl-auto: validate`
  never expects the table when Cognito is not configured.

The Cognito migration should live under `backend/db/cognito/` and be mounted or
applied only for a Cognito deployment, mirroring how
`backend/db/development/` is mounted only for development. It currently lives
in the same database schema but is never referenced by application code. If
strict schema separation is preferred, move it to a `cognito` schema and qualify
the adapter's queries.

## Registration, confirmation, and duplicate handling

### Request

Storing PII up front means registration must carry the profile fields. The
current `RegisterRequest(email, password)` grows to include the same fields the
register form already collects: first name, last name, DOB, city, state,
country, and postal code. The profile API cannot be used before confirmation
because it requires a session.

### Flow: Cognito first

1. Validate the request, including the password floor and profile fields.
2. Generate an application `userID` (UUID).
3. Call Cognito `SignUp` with `Username=email`, the email attribute, and the
   password. Cognito sends the verification code. Keep `UserSub` from the
   response.
4. In one local transaction:
   - insert `users` with the generated `userID` and email;
   - insert `profiles` with the submitted PII;
   - insert `cognito_users` with `subject = UserSub`, `status = PENDING`, and the
     application `userID`.
5. Return `201` with `{ "status": "CONFIRMATION_REQUIRED", "email": ... }`.

The Cognito call is outside the database transaction. If step 4 fails, the
Cognito user exists but the application rows do not. The accepted demo behavior
is:

- Return a retryable `500`; do not tell the user to confirm.
- Retry step 4 idempotently on the same `UserSub` if the request is repeated.
- At confirmation or login, if no `cognito_users` row exists, fail with
  `registration incomplete` rather than silently creating an application user
  with only an email. That would lose the PII the user entered.
- Do not implement automatic orphan cleanup. Manual cleanup is acceptable for
  the demo.

This ordering is intentional: Cognito is the credential authority, and the
application write follows. The tradeoff is that a database failure after
`SignUp` strands the email until cleanup. The alternative, database-first, would
let us roll back locally but leaves an application user if Cognito fails.

### Confirmation

Public endpoints:

- `POST /api/auth/register/confirm` with `{ email, code }`.
- `POST /api/auth/register/resend` with `{ email }`.

Confirmation calls Cognito `ConfirmSignUp` with the email as the username, then
sets `cognito_users.status = CONFIRMED`. It does not create a session; after a
successful confirmation the client either logs in with a retained password or
is routed to the login page with the email prefilled.

### Duplicate registration

`UsernameExistsException` says only that the identifier exists. It does not say
whether the account is confirmed, unconfirmed, disabled, or external. Do not
interpret it as “confirmation pending.”

The adapter consults `cognito_users` by email, using the most recent row when
historical rows exist:

| State                            | Response                                                |
| -------------------------------- | ------------------------------------------------------- |
| Row exists, `status = PENDING`   | `202` confirmation pending; offer resend                |
| Row exists, `status = CONFIRMED` | `409` already registered; offer sign-in or reset        |
| No row                           | Neutral “if this email is registered, sign in or reset” |

The confirmation page accepts an email and code and offers resend, so an
interrupted registration can be resumed from any tab or device. A user who
registers again while a PENDING row exists is routed there.

A successful login also sets `status = CONFIRMED`, which reconciles a user who
confirmed through a Cognito email link rather than the application's confirm
endpoint.

The pool's “prevent user existence errors” setting must be tested against this
behavior before finalizing error mapping. If it masks the exception, the
duplicate path must be adjusted.

### Unconfirmed rows

Because PII is stored before confirmation, unconfirmed `users` and `profiles`
rows can exist indefinitely. A retention/cleanup policy is deferred; for the
demo they remain until manually cleared. The `cognito_users.expiresAt` column is
available for a future cleanup job.

## Login, sessions, logout, and password change

### Login

1. Cognito `InitiateAuth` with `USER_PASSWORD_AUTH`, the email username, the
   password, and `SECRET_HASH` if the app client has a secret.
2. Verify the returned ID token locally with the pool's JWKS. Validate issuer,
   `aud` (client ID), `token_use = id`, expiry, `sub`, `email`, and
   `email_verified`.
3. Look up `cognito_users` by `subject`. Use its `userID`.
4. Update the application email and `cognito_users.email` if either changed.
5. Set `cognito_users.status = CONFIRMED` on a successful login, reconciling a
   confirmation that happened outside the application's confirm endpoint.
6. Create the application session with the Cognito refresh token.
7. Return `200 { email }` and set `jaakd_session`.

If no `cognito_users` row exists for a verified Cognito user, return
`registration incomplete` rather than auto-creating an application user. All
users are expected to register through the application.

If the user is unconfirmed, map `UserNotConfirmedException` to a distinct `403`
(for example `EMAIL_NOT_CONFIRMED`) so the frontend can route to the
confirmation page. Invalid credentials map to a generic `401`.

If Cognito returns an authentication challenge (MFA, `NEW_PASSWORD_REQUIRED`),
relay `202 { challenge, continuation }` as the existing seam allows. V1 has no
completion UI; the frontend must show a defensive “additional verification
required” message and must not navigate. See “Deferred.”

### Logout

- Load the session by ID.
- Call Cognito `RevokeToken` with that session's refresh token.
- Delete the local session, whether or not revocation succeeds; log a provider
  failure.
- Do not touch other sessions.

Each sign-in has its own Cognito refresh token, so revoking one session does not
affect the others.

### Change password

- Re-authenticate with the current password to obtain an access token and a
  temporary refresh token.
- Call Cognito `ChangePassword`.
- Revoke the temporary refresh token created by the re-authentication, so the
  change-password flow does not leave an extra Cognito session behind.
- Load the other sessions for the user, call `RevokeToken` for each refresh
  token, then delete those sessions.
- Keep the current session and its token.
- Do not use `GlobalSignOut`; that would revoke the current device as well.

Refresh tokens are secrets. They stay server-side in `sessions.refreshToken`,
must never be logged, and require database access controls. Production should
consider encryption at rest. Revocation is idempotent; skip missing, expired, or
already-revoked tokens.

## Password policy

Password strength belongs to the user pool. Development and production pools
may differ, and the application must not branch on the environment.

- Set the application floor to Cognito's minimum (6 characters) or keep only
  non-blank and maximum-length validation.
- Do not keep the current hard-coded `min 8` in the DTOs if it would reject a
  password the development pool accepts.
- Map Cognito `InvalidPasswordException` to `400` with a useful message.
- The frontend may keep a minimal local check and display the server error.
- Production pool strength is a deployment check, not a code branch. Verify the
  policy when creating or auditing the pool.

`1234567890` passes both the application floor and Cognito's minimum.

## Challenges, MFA, and password recovery

V1 assumes:

- MFA is off on the Cognito pool.
- All users are created through the application, so there are no temporary
  passwords that trigger `NEW_PASSWORD_REQUIRED`.

Even with those assumptions, handle `202` defensively: show “additional
verification required” and do not navigate. Do not build the challenge UI.

Deferred:

- `POST /api/auth/challenge` and challenge completion.
- MFA enrollment and verification UI.
- `NEW_PASSWORD_REQUIRED` handling.
- Forgot-password endpoints and UI.

The backend already has `SignInOutcome.Challenge`, `ChallengeRequiredException`,
and a `202` response. If the challenge is retained, give it a typed
`ChallengeResponse` body rather than reusing `ErrorResponse`; a challenge is not
an error.

## Pool lifecycle and stability

`sub` is stable for the life of a user pool. It changes only when the pool is
deleted and recreated. Editing the app client, password policy, token lifetimes,
attributes, or MFA settings does not change it.

Therefore:

- Enable deletion protection on any pool that holds real users.
- If the pool is later managed by IaC, set `prevent_destroy` or the equivalent.
- Choose immutable settings correctly now: email-as-username, alias
  configuration, and case sensitivity cannot be changed later without a new
  pool.
- Treat pool replacement as a migration, not a reset.

If the pool is recreated:

- The new pool has a new pool ID and new `sub` values.
- Old `cognito_users.subject` rows are stale.
- Existing application sessions continue until their TTL, because the
  application session is the authority.
- A new login finds no mapping. For the demo, reset the database and pool
  together and clear `cognito_users`; otherwise the login must fail as
  “registration incomplete” rather than create a duplicate application user.

For a real migration, the available mechanisms are:

- A user-migration Lambda on the new pool that verifies against the old pool or
  a legacy credential source and creates the user on first sign-in. This works
  only while the old credential source exists.
- A `custom:userId` attribute carrying the application UUID, used as a hint when
  relinking. Do not trust it for authorization; custom attributes can be changed
  by the user.
- Relinking by verified email. Convenient, but risky because email addresses are
  recycled; production should require explicit confirmation or consent.
- Admin migration. Cognito does not export password hashes, so users must reset.

None of these preserve a deleted Cognito identity. They preserve the
application user and repair the link. For the demo, no migration code is
implemented.

## Configuration

```yaml
identity:
  provider: ${IDENTITY_PROVIDER}
  cognito:
    region: ${COGNITO_REGION:}
    user-pool-id: ${COGNITO_USER_POOL_ID:}
    client-id: ${COGNITO_CLIENT_ID:}
    client-secret: ${COGNITO_CLIENT_SECRET:}
    endpoint-override: ${COGNITO_ENDPOINT_OVERRIDE:}
```

- Bind the Cognito properties only inside the `identity.provider=cognito`
  configuration, so a development run without Cognito values still starts.
- Add the values to `.env.example` and pass them through Compose only when
  Cognito is used.
- Local values may live in `.env`. Production values, especially the client
  secret, belong in a secret manager or file-based secret.
- `endpoint-override` exists for LocalStack or cognito-local testing.
- Configure SDK timeouts and retries. For non-admin user-pool calls, avoid the
  default credentials chain probing IMDS; use anonymous credentials or a
  short-timeout provider. V1 needs no IAM permissions.

## AWS setup

Create one user pool per environment.

### User pool

- Sign-in with email as the username.
- `AutoVerifiedAttributes = ["email"]`.
- MFA off for v1.
- Password policy: development may use the minimum; production uses the agreed
  strength. The application does not encode the difference.
- Default Cognito email sender and verification message. No SES.
- Deletion protection on for any pool with real users.
- Self-registration allowed.

### App client

- Confidential client with a generated secret.
- Enable `ALLOW_USER_PASSWORD_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH`.
- Disable SRP and custom auth flows unless they are implemented.
- Enable token revocation.
- Enable “prevent user existence errors”; verify its effect on the duplicate
  registration path.
- No hosted UI, callback URLs, or CORS configuration; the frontend never talks
  to Cognito.

### Operations

- No IAM admin permissions for v1. `SignUp`, `ConfirmSignUp`,
  `ResendConfirmationCode`, `InitiateAuth`, `ChangePassword`, and `RevokeToken`
  are user-pool APIs.
- The app client secret requires `SECRET_HASH` on `SignUp`, `ConfirmSignUp`,
  `ResendConfirmationCode`, and `InitiateAuth`. `RevokeToken` takes the client
  secret directly. Centralize the hash calculation.
- Cognito's default email quota is 50 messages per day per pool. Test delivery
  to common domains before the demo; the sender can land in spam.
- Ensure outbound HTTPS to `cognito-idp.<region>.amazonaws.com`; add a VPC
  endpoint only if the backend runs without NAT.
- Add CloudWatch alarms for sign-up/sign-in throttling and authentication
  failures.
- No SES production-access request is needed.
- There is no IaC yet. Record the pool and app-client settings so they can be
  recreated.

## API contract

- `POST /api/auth/register`
  - Request: email, password, and profile fields.
  - `201 { status: "CONFIRMATION_REQUIRED", email }`.
  - `202 { challenge: "EMAIL_CONFIRMATION", email }` when a pending
    registration already exists.
  - `409` when the email is already confirmed.
- `POST /api/auth/register/confirm`
  - Request: `{ email, code }`.
  - `200 { email }` on success; `400` for a bad or expired code.
- `POST /api/auth/register/resend`
  - Request: `{ email }`; `204` on success.
- `POST /api/auth/login`
  - `200 { email }` or `202 { challenge, continuation }`.
  - `403 { details: { code: "EMAIL_NOT_CONFIRMED", email } }`.
  - `401` for invalid credentials.
- `POST /api/auth/logout` — unchanged externally.
- `POST /api/auth/change-password` — unchanged externally.

The frontend switches on status and body shape. No proxy is needed; the endpoint
contract is the source of truth. Give challenge and confirmation responses
typed bodies rather than `ErrorResponse`.

## Backend changes

### Dependencies

- AWS SDK v2 BOM and `software.amazon.awssdk:cognitoidentityprovider`.
- `org.springframework.security:spring-security-oauth2-jose` for
  `NimbusJwtDecoder`.

### New code

- `identity/RegistrationOutcome.java`.
- `identity/cognito/CognitoIdentityProvider.java`.
- `identity/cognito/CognitoIdTokenVerifier.java`.
- `identity/cognito/CognitoExceptionTranslator.java`.
- `identity/cognito/SecretHash.java`.
- `identity/cognito/CognitoUserStore.java` using `JdbcTemplate` for
  `cognito_users`.
- `config/CognitoProperties.java`.
- `config/CognitoClientConfig.java`, conditional on
  `identity.provider=cognito`.
- `service/RegistrationService.java` for the application-side user/profile
  creation transaction.
- DTOs: expanded `RegisterRequest`, `ConfirmRegistrationRequest`,
  `ResendRegistrationRequest`, `RegistrationResponse`, `ChallengeResponse`.
- Exceptions and handlers for confirmation pending, email not confirmed, and
  provider throttling/unavailability.

### Port changes

`IdentityProvider` gains provider registration/confirmation/revocation
operations. A workable shape:

```java
public interface IdentityProvider {
    RegistrationOutcome register(UUID userId, String email, String password);
    void link(UUID userId, String subject, String email);
    void confirmRegistration(String email, String code);
    void resendConfirmation(String email);
    SignInOutcome signIn(String email, String password);
    void changePassword(String email, String currentPassword, String newPassword);
    void revoke(String refreshToken);
}
```

`SignInOutcome.Authenticated` gains the refresh token:

```java
record Authenticated(UUID userId, String email, String refreshToken)
        implements SignInOutcome {}
```

`RegistrationOutcome` carries the provider subject and whether confirmation is
required:

```java
public record RegistrationOutcome(String subject, boolean confirmationRequired) {}
```

The development adapter:

- inserts `development_credentials` with the application `userID`;
- returns `subject = userID`, `confirmationRequired = false`;
- no-ops `link`, `confirmRegistration`, `resendConfirmation`, and `revoke`;
- keeps the current bcrypt password change.

The Cognito adapter:

- `register` calls `SignUp` and returns `UserSub`;
- `link` inserts the `cognito_users` PENDING row;
- `confirmRegistration` calls `ConfirmSignUp` and updates status;
- `resendConfirmation` calls `ResendConfirmationCode`;
- `signIn` verifies the ID token, resolves `subject` to `userID`, and returns the
  refresh token;
- `changePassword` re-authenticates, calls `ChangePassword`, and does not revoke
  other sessions itself (that is `AuthService`'s job);
- `revoke` calls `RevokeToken`.

### Existing code to change

- `AuthService`: orchestrate registration, confirmation, login, logout
  revocation, and password-change revocation.
- `SessionService`: expose the other sessions' refresh tokens before deleting
  them.
- `UserProvisioner`: keep email refresh; do not auto-create on missing Cognito
  link.
- `AuthController`: new endpoints and response types.
- `SecurityConfig`: permit `/api/auth/register/confirm` and
  `/api/auth/register/resend`.
- `GlobalExceptionHandler`: map the new exceptions.
- `application.yaml`: Cognito properties.
- `.env.example`, `docker-compose.yml`, docs.
- `openapi.yaml`: new endpoints and response schemas.

### Database

- Add `backend/db/cognito/01-cognito-users.sql` with the table, index, and
  grant.
- Mount or apply it only when Cognito is configured.
- No change to `users` or `profiles` beyond creating rows earlier.
- `development_credentials` remains unchanged.

## Frontend changes

- `AuthService.register` sends the profile fields and returns a typed result:
  confirmation required, pending, or conflict.
- The register component no longer creates the profile after login; the profile
  is created during registration. The post-login profile fetch remains, but the
  404/create path is removed from the register flow.
- Add a public `/auth/confirm` page with the email, code field, resend action,
  and a success path to login.
- On registration, route to the confirmation page. The password is not persisted
  across the route; the user logs in after confirmation.
- On login, handle `403 EMAIL_NOT_CONFIRMED` by routing to confirmation, and
  `202` by showing the defensive challenge message without navigating.
- Add the confirm/resend methods to `AuthService`.
- No Cognito SDK, no provider name, and no token handling in the browser.
- Add the route as public in `app.routes.ts`.

## Tests

- Cognito adapter unit tests with a mocked `CognitoIdentityProviderClient`:
  sign-up, duplicate handling, confirmation, resend, login, error mapping,
  `SECRET_HASH`.
- ID-token verifier tests with generated keys and negative cases: wrong issuer,
  wrong audience, access token instead of ID token, expired, missing email,
  unverified email, missing `sub`.
- `AuthService` tests: refresh token stored, logout revokes one token, password
  change revokes the other sessions' tokens, no auto-provision on missing link.
- Registration orchestration test: Cognito-first order, transaction rollback,
  retry behavior.
- Conditional configuration test: development starts without Cognito values.
- Frontend tests for registration success/pending/conflict, confirmation,
  unconfirmed login, and 202 handling.
- Optional integration test against LocalStack or cognito-local; keep it out of
  CI so the pipeline needs no AWS account.

## Execution plan

### Phase 0 — Record decisions

- Add this note. (Done.)

### Phase 1 — Foundations

1. Add the AWS SDK and `spring-security-oauth2-jose` dependencies.
2. Add `CognitoProperties` and the conditional `CognitoClientConfig`.
3. Add `backend/db/cognito/01-cognito-users.sql` and the deployment hook that
   applies it only for Cognito.
4. Add `CognitoUserStore` using `JdbcTemplate`.
5. Add the new exceptions and `GlobalExceptionHandler` mappings.
6. Add the configuration values to `.env.example`, Compose, and docs.

### Phase 2 — Port and development adapter

1. Add `RegistrationOutcome`.
2. Extend `SignInOutcome.Authenticated` with the refresh token.
3. Add `register`, `link`, `confirmRegistration`, `resendConfirmation`, and
   `revoke` to `IdentityProvider`.
4. Adapt `DevelopmentIdentityProvider` to take the application `userID` and
   implement the new methods as no-ops where appropriate.
5. Update `AuthServiceTest` and any development-provider tests.

### Phase 3 — Cognito adapter

1. Implement `SecretHash`.
2. Implement `CognitoIdTokenVerifier` with JWKS, issuer, audience, `token_use`,
   and email checks.
3. Implement `CognitoIdentityProvider` for `SignUp`, `ConfirmSignUp`,
   `ResendConfirmationCode`, `InitiateAuth`, `ChangePassword`, and
   `RevokeToken`.
4. Implement duplicate handling against `cognito_users`.
5. Implement exception translation and add unit tests.

### Phase 4 — Orchestration and API

1. Implement `RegistrationService`: Cognito `SignUp`, then one local transaction
   creating `users`, `profiles`, and the `cognito_users` link. Reuse the existing
   profile validation rather than duplicating it.
2. Expand `RegisterRequest` to carry profile fields.
3. Add confirm and resend DTOs and controller endpoints.
4. Permit the new endpoints in `SecurityConfig`.
5. Update login to store the refresh token and map unconfirmed users.
6. Update logout to revoke the session's refresh token.
7. Update password change to revoke the other sessions' refresh tokens before
   deleting them.
8. Make a missing `cognito_users` row fail as “registration incomplete.”
9. Update `openapi.yaml`.
10. Add integration-level tests for the orchestration.

### Phase 5 — Frontend

1. Update `AuthService.register` and its payload.
2. Remove the post-login profile-creation branch from the register component.
3. Add the confirmation page and route.
4. Handle pending/conflict/unconfirmed responses.
5. Add the defensive `202` branch.
6. Add component and service tests.

### Phase 6 — AWS and deployment

1. Create the development Cognito pool and app client using the settings above.
2. Record the pool ID, client ID, region, and client secret.
3. Add the values to the local `.env`; use a secret manager for deployed
   environments.
4. Verify email delivery and the 50/day quota.
5. Verify duplicate-registration behavior with the pool's
   “prevent user existence errors” setting.
6. Document the pool-recreation runbook.

### Phase 7 — Verification

1. Run backend unit and integration tests.
2. Run frontend tests.
3. Walk the end-to-end flow: register, receive code, confirm, log in, refresh
   the app, log out.
4. Verify an interrupted registration can be resumed from the confirmation page.
5. Verify logout leaves other sessions alive and password change ends them.
6. Verify the development provider still starts and works without Cognito
   configuration.
7. Verify that stopping the pool or misconfiguring MFA produces a clear error,
   not a silent navigation.

## Deferred

- MFA and challenge completion (`/api/auth/challenge`).
- `NEW_PASSWORD_REQUIRED` handling.
- Forgot-password flow.
- Registration restriction via admin-only or invite.
- Email-change flow.
- Cross-provider user linking.
- Automatic orphan Cognito-user cleanup.
- Retention and cleanup of unconfirmed `users`/`profiles` rows.
- IaC for the pool and app client.
- Jenkins pipeline changes; another workstream is in flight. Record the drift
  but do not modify it here.

## Why this matters for future agents

- `users.userID` is application-owned. Do not store a provider `sub` as the
  primary key.
- Provider link tables are adapter-owned. Do not add a generic identity table
  that development must populate.
- Do not add provider columns to `users`.
- Do not add Cognito SDK code to the frontend.
- Do not auto-create an application user when a Cognito login has no link; that
  silently loses registration data and creates duplicates.
- Do not recreate a user pool with real users. `sub` is not portable across
  pools.
- The application session is the authority for its APIs; the Cognito session is
  independent and is revoked per session.

## Implementation status

Done:

- AWS SDK v2 and `spring-security-oauth2-jose` dependencies.
- Conditional Cognito properties and client configuration.
- Adapter-owned `cognito_users` migration.
- `IdentityProvider` port changes, application-owned user IDs, and the
  development adapter update.
- Cognito adapter, JWKS ID-token verification, exception translation, and
  `SECRET_HASH`.
- Cognito-first registration with PII stored up front, confirm/resend endpoints,
  duplicate handling, login, logout revocation, and password-change revocation.
- Frontend registration payload, confirmation page, unconfirmed-login routing,
  and defensive `202` handling.
- Backend and frontend tests.
- AWS setup and pool-recreation runbook in `docs/cognito-setup.md`.

Remaining environment work:

- Create the demo Cognito pool and app client.
- Put the pool/client values and client secret into the deployment.
- Apply `backend/db/cognito/01-cognito-users.sql` to the Cognito database.
- Verify default-email delivery to the demo recipients.

## Scope note

This note records decisions and the execution plan. The code and configuration
changes described above are implemented; creating AWS resources remains an
operator step documented in `docs/cognito-setup.md`.
