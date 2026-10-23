# Cognito Identity Provider — Decisions and Execution Plan

Follows `05-identity-provider-seam-notes.md` and `06-configuration-and-secrets-notes.md`.
This note records the decisions for adding Amazon Cognito as a second
`IdentityProvider` adapter, and the plan to execute them.

Status: backend, database, frontend, and tests are implemented. The AWS pool
and app client are created through the console runbook in
`docs/cognito-setup.md`; deployment values and delivery verification remain.

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
- Cognito's username is that same application `userID`; the email address is a
  verified Cognito alias.
- The `registrationId` returned by registration is the application `userID`.
- `ConfirmSignUp` uses `ForceAliasCreation=true`, so the email owner can claim
  an address that an unconfirmed account has already used.
- A pending email does not block a new registration. Only a confirmed email
  returns `409`.
- Superseded pending rows are not cleaned up after a claim.
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
- The duplicate-pending `202 EMAIL_CONFIRMATION` response is removed.
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

-- Development-provider-owned credentials.
-- "userID" is the application user ID; only the development adapter reads it.
CREATE TABLE IF NOT EXISTS development_credentials (
  "userID" UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- Cognito-adapter-owned link table; only the Cognito adapter reads it.
CREATE TABLE IF NOT EXISTS cognito_users (
  "identityID" UUID PRIMARY KEY,
  "userID" UUID NOT NULL UNIQUE REFERENCES users("userID") ON DELETE CASCADE,
  subject TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, -- PENDING | CONFIRMED
  "signUpSession" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMP
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cognito_users TO jaakd_app;
```

All primary keys are single UUIDs. `subject` and `userID` are single-column
unique constraints. `users.email` is the application-owned address; `cognito_users`
links a provider subject to a user and does not duplicate it. `development_credentials.email`
remains the development login identifier.

`cognito_users` is adapter-owned:

- Only the selected adapter reads its table; the other table is inert.
- Development uses `JdbcTemplate`. Cognito maps `cognito_users` with a JPA
  entity and repository, so Hibernate validates that table at startup.

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
3. Call Cognito `SignUp` with `Username=userID`, the email attribute, and the
   password. Cognito sends the verification code. Keep `UserSub` from the
   response.
4. In one local transaction:
   - insert `users` with the generated `userID` and email;
   - insert `profiles` with the submitted PII;
   - insert `cognito_users` with `subject = UserSub`, `status = PENDING`, the
     application `userID`, and the SignUp session;
5. Return `201` with `{ "status": "CONFIRMATION_REQUIRED", "email": ..., "registrationId": ... }`.

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

- `POST /api/auth/register/confirm` with `{ registrationId, code }`.
- `POST /api/auth/register/resend` with `{ registrationId }`.

Confirmation loads the pending row by `userID` and calls Cognito
`ConfirmSignUp` with the UUID as the username, the stored `signUpSession`, the
code, and `ForceAliasCreation=true`. It then passes the `Session` returned by
`ConfirmSignUp` to `InitiateAuth` with `USER_AUTH`, verifies the ID token, and
creates the application session. No password is retained in the browser.

If Cognito returns no confirmation session, or the automatic sign-in fails, the
endpoint returns `204` and the client routes to login with the email prefilled.
An expired SignUp session is retried without it so a valid code can still
confirm the account. This requires the app client to allow `ALLOW_USER_AUTH` and
the pool to allow email OTP as a first auth factor.

### Duplicate registration

Cognito's username is a fresh UUID, so `UsernameExistsException` is no longer a
meaningful duplicate-email signal. The adapter checks the local link table
before calling `SignUp`:

| State                            | Response                                                |
| -------------------------------- | ------------------------------------------------------- |
| Row exists, `status = CONFIRMED` | `409` already registered; offer sign-in                 |
| No confirmed row                 | Allow the new registration; a pending row does not block |

The new registration gets a new `userID` and Cognito username. On confirmation,
`ForceAliasCreation` moves the verified email alias to the new account and marks
the previous account's email unverified. This is how the real owner claims an
address that an unconfirmed registrant already used.

The confirmation page accepts `registrationId` and a code and offers resend. The
registration ID is kept in the URL and optional `sessionStorage`; no password is
stored.

A successful login also sets `status = CONFIRMED`, which reconciles a user who
confirmed through a Cognito email link rather than the application's confirm
endpoint.

The pool's “prevent user existence errors” setting must be tested against this
behavior before finalizing error mapping. If it masks the exception, the
duplicate path must be adjusted.

### Unconfirmed rows

Because PII is stored before confirmation, unconfirmed `users` and `profiles`
rows can exist indefinitely. Superseded pending rows are deliberately not
cleaned up after a claim; there is no retention sweep. The
`cognito_users.expiresAt` column is available for a future cleanup job.

## Login, sessions, logout, and password change

### Login

1. Cognito `InitiateAuth` with `USER_PASSWORD_AUTH`, the email alias as the
   username, the password, and `SECRET_HASH` if the app client has a secret.
2. Verify the returned ID token locally with the pool's JWKS. Validate issuer,
   `aud` (client ID), `token_use = id`, expiry, `sub`, `email`, and
   `email_verified`.
3. Look up `cognito_users` by `subject`. Use its `userID`.
4. Update `users.email` from the verified token.
5. Set `cognito_users.status = CONFIRMED` on a successful login, reconciling a
   confirmation that happened outside the application's confirm endpoint.
6. Create the application session with the Cognito refresh token.
7. Return `200 { email }` and set `jaakd_session`.

If no `cognito_users` row exists for a verified Cognito user, return
`registration incomplete` rather than auto-creating an application user. All
users are expected to register through the application.

If the user is unconfirmed, the alias may not resolve during login. If
`InitiateAuth` fails and the local link table has a pending row for the email
but no confirmed row, map it to a distinct `403` (for example
`EMAIL_NOT_CONFIRMED`) so the frontend can route to confirmation or registration.
A confirmed account with a wrong password remains a generic `401`.

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
    api-call-timeout: ${COGNITO_API_CALL_TIMEOUT:PT10S}
    api-call-attempt-timeout: ${COGNITO_API_CALL_ATTEMPT_TIMEOUT:PT5S}
    retry-attempts: ${COGNITO_RETRY_ATTEMPTS:2}
```

- Bind the Cognito properties only inside the `identity.provider=cognito`
  configuration, so a development run without Cognito values still starts.
- Add the values to `.env.example` and pass them through Compose only when
  Cognito is used.
- Local values may live in `.env`. Production values, especially the client
  secret, belong in a secret manager or file-based secret.
- Configure SDK timeouts and retry attempts. For non-admin user-pool calls, avoid
  the default credentials chain probing IMDS; use anonymous credentials or a
  short-timeout provider. V1 needs no IAM permissions.

## AWS setup

Create one user pool per environment.

### User pool

- Sign-in with an opaque UUID username and the email as a verified alias.
- `AliasAttributes = ["email"]`; no `UsernameAttributes`.
- `AutoVerifiedAttributes = ["email"]`.
- MFA off for v1.
- Password policy: development may use the minimum; production uses the agreed
  strength. The application does not encode the difference.
- Default Cognito email sender and verification message. No SES.
- Deletion protection on for any pool with real users.
- Self-registration allowed.
- Sign-in policy allows `PASSWORD` and `EMAIL_OTP`; `EMAIL_OTP` is required for
  automatic sign-in after confirmation.

### App client

- Confidential client with a generated secret.
- Enable `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`, and
  `ALLOW_USER_AUTH`.
- Set the authentication flow session duration to 15 minutes so the email code
  can be entered before the confirmation session expires.
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
  - `201 { status: "CONFIRMATION_REQUIRED", email, registrationId }`.
  - `409` when the email already has a confirmed account.
- `POST /api/auth/register/confirm`
  - Request: `{ registrationId, code }`.
  - `200 { email }` when the confirmation session signs the user in; `204`
    when the client must sign in separately; `400` for a bad or expired code.
- `POST /api/auth/register/resend`
  - Request: `{ registrationId }`; `204` on success.
- `POST /api/auth/login`
  - `200 { email }` or `202 { challenge, continuation }`.
  - `403 { details: { code: "EMAIL_NOT_CONFIRMED", email } }`.
  - `401` for invalid credentials.
- `POST /api/auth/logout` — unchanged externally.
- `POST /api/auth/change-password` — unchanged externally.

The frontend switches on the typed response body. No proxy is needed; the
endpoint contract is the source of truth. Give challenge responses typed bodies
rather than `ErrorResponse`. `registrationId` is an opaque UUID, not a secret.

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
- `identity/cognito/CognitoUser.java` and `CognitoUserRepository.java` for the
  adapter-owned `cognito_users` mapping.
- `identity/cognito/CognitoUserStore.java` for link-table operations.
- `config/CognitoProperties.java`.
- `config/CognitoClientConfig.java`, conditional on
  `identity.provider=cognito`.
- `service/RegistrationService.java` for the application-side user/profile
  creation transaction.
- DTOs: expanded `RegisterRequest`, `ConfirmRegistrationRequest`,
  `ResendRegistrationRequest`, `RegistrationResponse`, `ChallengeResponse`.
- Exceptions and handlers for email not confirmed, provider throttling, and
  provider unavailability. There is no confirmation-pending exception.

### Port changes

`IdentityProvider` gains provider registration/confirmation/revocation
operations. A workable shape:

```java
public interface IdentityProvider {
    RegistrationOutcome register(UUID userId, String email, String password);
    void link(UUID userId, String subject, String signUpSession);
    Optional<SignInOutcome.Authenticated> confirmRegistration(UUID registrationId, String code);
    void resendConfirmation(UUID registrationId);
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
public record RegistrationOutcome(String subject, boolean confirmationRequired, String signUpSession) {}
```

The development adapter:

- inserts `development_credentials` with the application `userID`;
- returns `subject = userID`, `confirmationRequired = false`, and a null session;
- no-ops `link`, returns `Optional.empty()` from `confirmRegistration`, and
  no-ops `resendConfirmation` and `revoke`;
- keeps the current bcrypt password change.

The Cognito adapter:

- `register` rejects only a confirmed local email, calls `SignUp` with
  `Username=userID`, and returns `UserSub` plus the SignUp session;
- `link` inserts the `cognito_users` PENDING row with the session;
- `confirmRegistration` loads by `userID`, passes the stored session to
  `ConfirmSignUp` with `ForceAliasCreation=true`, then uses the confirmation
  session with `USER_AUTH`; it returns an authenticated outcome when that
  succeeds and `Optional.empty()` otherwise;
- `resendConfirmation` calls `ResendConfirmationCode` with the UUID username;
- `signIn` uses the email alias, verifies the ID token, resolves `subject` to
  `userID`, and returns the refresh token;
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

- Add `cognito_users` and its grant to `backend/db/init/01-schema.sql`; the
  existing `development_credentials` table is unchanged.
- No change to `users` or `profiles` beyond creating rows earlier.

## Frontend changes

- `AuthService.register` sends the profile fields and returns a typed result:
  confirmation required with a `registrationId`, or registered.
- The register component no longer creates the profile after login; the profile
  is created during registration. The post-login profile fetch remains, but the
  404/create path is removed from the register flow.
- Add a public `/auth/confirm` page with the email, code field, resend action,
  and a success path that signs the user in.
- The register component keeps the non-secret `registrationId` in the confirm
  URL and optional `sessionStorage` so confirmation can resume after a reload.
- `AuthService.confirmRegistration` uses `observe: 'response'`: a `200` carries
  the session body and sets the email signal; a `204` means confirmation
  succeeded but the client must route to login with the email prefilled.
- No password is retained in browser memory or storage.
- On login, handle `403 EMAIL_NOT_CONFIRMED` by using a stored `registrationId`
  when available, otherwise routing to registration to claim the address. Handle
  `202` by showing the defensive challenge message without navigating.
- Add the confirm/resend methods to `AuthService`.
- No Cognito SDK, no provider name, and no token handling in the browser.
- Add the route as public in `app.routes.ts`.

## Tests

- Cognito adapter unit tests with a mocked `CognitoIdentityProviderClient`:
  sign-up with the UUID username, confirmed-email rejection, confirmation with
  `ForceAliasCreation`, resend by registration ID, login, pending-only error
  mapping, and `SECRET_HASH`.
- ID-token verifier tests with generated keys and negative cases: wrong issuer,
  wrong audience, access token instead of ID token, expired, missing email,
  unverified email, missing `sub`.
- `AuthService` tests: refresh token stored, logout revokes one token, password
  change revokes the other sessions' tokens, no auto-provision on missing link,
  and confirmation by `registrationId`.
- Registration orchestration test: Cognito-first order, transaction rollback,
  retry behavior.
- Conditional configuration test: development starts without Cognito values.
- Frontend tests for registration confirmation/conflict, `registrationId`
  continuation, confirmation, unconfirmed login, and 202 handling.
- Optional integration test against LocalStack or cognito-local; keep it out of
  CI so the pipeline needs no AWS account.

## Execution plan

### Phase 0 — Record decisions

- Add this note. (Done.)

### Phase 1 — Foundations

1. Add the AWS SDK and `spring-security-oauth2-jose` dependencies.
2. Add `CognitoProperties` and the conditional `CognitoClientConfig`.
3. Add both provider link tables to `backend/db/init/01-schema.sql`.
4. Add `CognitoUser`, `CognitoUserRepository`, and `CognitoUserStore`.
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
- Base schema contains both provider link tables (`development_credentials`,
  `cognito_users`) in every environment.
- `IdentityProvider` port changes, application-owned user IDs, and the
  development adapter update.
- Cognito adapter, JWKS ID-token verification, exception translation, and
  `SECRET_HASH`.
- Cognito-first registration with PII stored up front, UUID username, email
  alias, confirm/resend by `registrationId`, duplicate handling, login, logout
  revocation, and password-change revocation.
- Registration flushes the `users` insert before the JDBC provider-link insert;
  the link's foreign key otherwise cannot see a queued Hibernate insert.
- Frontend registration payload, registration-ID continuation, confirmation
  page, native automatic sign-in from the confirmation session, unconfirmed-login
  routing, and defensive `202` handling.
- Backend and frontend tests.
- AWS setup and pool-recreation runbook in `docs/cognito-setup.md`.

Remaining environment work:

- Put the new pool/client values and client secret into the deployment.
- Verify default-email delivery to the demo recipients.

## Scope note

This note records decisions and the execution plan. The code and configuration
changes described above are implemented; creating AWS resources remains an
operator step documented in `docs/cognito-setup.md`.
