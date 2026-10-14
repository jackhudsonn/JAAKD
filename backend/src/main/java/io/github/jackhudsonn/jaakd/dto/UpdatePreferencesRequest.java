package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record UpdatePreferencesRequest(
    @NotNull(message = "dashboardWidgets is required")
    List<String> dashboardWidgets
) {
}