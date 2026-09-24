# Java Formatter Notes

Context for backend Java formatting decisions discussed during repository query refactors.

## Decision

- Prefer adopting Google Java Format for backend Java files to remove manual spacing and wrapping drift.
- Keep policy-level decisions (for example, when to use `@Query` and method naming conventions) in AGENTS.md.
- Let the formatter enforce mechanical style: indentation, blank lines, line wrapping, and alignment.

## Why

- Prevents repeated formatting cleanup in repository and service files.
- Reduces review noise so PR feedback can focus on behavior and correctness.
- Makes style deterministic across contributors and agents.

## Proposed rollout

1. Add Spotless Maven plugin in backend/pom.xml with google-java-format.
2. Run formatter once across backend Java sources.
3. Add spotless check in CI to prevent style regressions.
4. Keep AGENTS.md concise and complementary to formatter rules.

## Scope note

- This note records direction only; it does not itself change build tooling.
