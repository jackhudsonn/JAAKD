package io.github.jackhudsonn.jaakd.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PreferencesResponse(
    UUID preferenceId,
    UUID portfolioId,
    List<String> dashboardWidgets,
    Instant createdAt,
    Instant updatedAt
) {
}