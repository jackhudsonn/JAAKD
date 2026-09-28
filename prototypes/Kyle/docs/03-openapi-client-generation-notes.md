# OpenAPI Client Generation Notes

Context for consuming the external Fauxnance/Scrumtuous API from backend.

## What was validated

- The generator setup is active in backend/pom.xml via openapi-generator-maven-plugin during generate-sources.
- Generated sources compile in this repository with Spring-friendly client generation (RestTemplate library).
- No backend runtime wiring was required to validate generation itself.

## Version findings

- Spring Boot in repo: 4.1.1.
- OpenAPI generator plugin originally tested at 7.9.0 caused Spring-client compile errors.
- Upgrading generator plugin to 7.25.0 resolved those Spring-client compile errors in this project.

## Why the earlier Spring-friendly attempt failed

With the older generator version, generated code referenced methods/signatures that did not match the Spring API surface in this stack.

Observed failure pattern:

- HttpHeaders method expectations mismatch
- UriComponentsBuilder method expectations mismatch

Net effect: generated client would not compile at 7.9.0 in this backend.

## Current generated client shape (what implementation will consume later)

Generated package root:

- io.github.jackhudsonn.jaakd.client.scrumtuous

Key classes:

- api/DefaultApi: operation methods like getSymbol, getQuote, getQuotes, getCandles, getUsage, getHealth.
- invoker/ApiClient: base URL, auth registry, request execution.
- invoker/auth/ApiKeyAuth: injects X-Api-Key auth header.
- model/*: strongly typed response/request DTOs from the spec.

## Integration shape to expect (when implementation starts)

- Create/configure one ApiClient bean.
- Set base path and API key once.
- Inject DefaultApi where external calls are needed.
- Map generated model DTOs to internal backend domain models/services.
- Handle HTTP/transport exceptions and convert to internal error contracts.

## Operational caveats

- Spec source is remote URL; generation depends on network access to scrumtuous.com.
- For deterministic/offline CI, consider pinning a local copy of api.json in-repo and pointing inputSpec to that file.
- OpenAPI 3.1 support is still evolving in generator ecosystem; keep plugin upgrades explicit and tested.

## Suggested next implementation step (not done yet)

- Add a small adapter interface around DefaultApi in backend so service code depends on internal abstraction, not generated classes directly.
- This keeps generated code replaceable if provider/schema/generator changes later.

## Scope note

- This note documents prototype conclusions only.
- It does not itself wire generated client calls into controllers/services/repositories.
