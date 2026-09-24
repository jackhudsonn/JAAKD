# AGENTS

## Backend Guardrails

### Spring Data Repository Queries

1. Prefer Spring Data derived query methods for simple repository lookups.
2. Use `@Query` when a derived method name is hard to read or maintain.
3. Keep `@Query` method names concise and intent-focused.
