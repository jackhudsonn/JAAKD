# JWT Signing Key Notes

Review concern for the shared `JWT_SECRET` introduced with the local
Postgres stack (PR #49, `feat/local-postgres`). Nothing here is implemented
yet; this note records the concern and the direction.

## The concern

- `auth-service` signs access tokens with HS256 using `JWT_SECRET`
  (`auth-service/src/auth/auth.service.ts`, `generateAccessToken`).
- The backend validates those tokens with the **same** value
  (`SecurityConfig.jwtDecoder`, fed by `jwt.shared-secret: ${JWT_SECRET}` in
  `backend/src/main/resources/application.yaml`). HS256 is symmetric, so the
  verifier must hold the signer's key — this is not a convenience choice, the
  algorithm forces it.
- Consequence: the backend, which only needs to *verify*, can also *mint* a
  valid token for any `sub`. A leak from either service (env var,
  `docker inspect`, config dump, CI log) is enough to impersonate any user.
- The value is duplicated and injected in several places: root `.env.example`,
  `backend/.env.example`, `auth-service/.env.example`, and
  `docker-compose.yml` passes `${JWT_SECRET}` into both `jaakd-auth` and
  `jaakd-backend`. Nothing enforces they stay equal, and rotation is
  all-or-nothing — change every copy and both containers together, or every
  API call 401s.
- This is a trust-topology problem, not a cryptographic one. HS256 itself is
  sound, the algorithm is pinned to `HS256` on both sides (which closes the
  classic algorithm-confusion attack), and auth-service enforces a 32-char
  minimum. The issue is that a verifying service holds a signing capability.

## Decision

Move to RS256 (asymmetric) with a JWKS endpoint on auth-service. The backend
verifies with public keys only and holds no secret.

**Rotation decides the mechanism.** A pinned public key in the backend would
still require redeploying the backend to rotate, which defeats the point. With
a JWKS URI, rotation is a change on the auth-service side only.

Spring's decoder is built for this. `NimbusJwtDecoder.withJwkSetUri(...)`
caches the JWKS and re-fetches when a token arrives with an unknown `kid`
(verified in `spring-security-oauth2-jose` 7.1.1:
`JwkSetUriJwtDecoderBuilder$SpringJWKSource.getJWKSet` calls
`evaluator.requiresRefresh(...)` then re-fetches). No backend restart, no
redeploy, no config change per rotation.

## Change outline

### auth-service

- Sign with an RSA private key (PKCS#8) instead of the shared secret:
  `jwt.sign(payload, privateKey, { algorithm: 'RS256', keyid, expiresIn: '15m' })`.
- Verify its own access tokens (used by `changePassword`) with the public key.
- Add a JWKS route that publishes the public half of **every** key still
  accepted, not just the active one. Node's `crypto` can export the JWK
  (`createPublicKey(...).export({ format: 'jwk' })`) — no new dependency.
- Hold a key **set**, not one key: a keys directory plus an active key id.
- Replace the `JWT_SECRET` length check in `main.ts` with key loading.

### backend

- `application.yaml`: `jwt.public-key-location` / `jwt.jwk-set-uri` replaces
  `jwt.shared-secret`.
- `SecurityConfig.jwtDecoder`: `NimbusJwtDecoder.withJwkSetUri(uri).build()`.
- Add an `iss` claim and validate it
  (`JwtValidators.createDefaultWithIssuer(...)`) — worth doing now that the
  JWKS URI is configuration.
- `application-test.yaml` swaps the property; existing tests mock
  `CurrentUserService` and never hit the decoder.

### config / infra

- `docker-compose.yml`: drop `JWT_SECRET` from both services; auth gets key
  material, backend gets `JWT_JWK_SET_URI: http://jaakd-auth:3000/auth/jwks.json`.
- Remove `JWT_SECRET` from the env examples; `backend/.env.example` loses its
  JWT line entirely.
- Store the private key as a mounted read-only file/secret, not an env var —
  rotation is as much about custody of the private key as publishing the
  public one.

## Rotation runbook (what the JWKS choice buys)

1. Generate `key-2`, publish its public half alongside `key-1`. Nothing signs
   with it yet; old tokens still carry `kid: key-1`.
2. Flip the active key to `key-2`. New tokens carry `kid: key-2`; the backend
   sees an unknown `kid`, re-fetches the JWKS, and accepts.
3. Wait past the access-token TTL (15m) plus clock skew, then remove `key-1`.

No step touches the backend.

## Why this matters for future agents

- Don't add a new service that only verifies tokens and give it `JWT_SECRET`.
  Under the current model that hands it a signing capability.
- Don't rotate the secret by editing one `.env` file; the copies must move
  together, which is exactly the fragility this change removes.
- If RS256 + JWKS is adopted, include the `kid` from the start — without it,
  rotation has no coordination mechanism.

## Scope note

- This note documents the concern and the proposed direction only.
- It does not itself change any code, config, or compose file.
