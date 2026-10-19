package io.github.jackhudsonn.jaakd.dto;

import java.util.UUID;

public record AuditUserSearchResponse(
    UUID userId,
    String email,
    String username,
    String firstName,
    String lastName
) {
}
