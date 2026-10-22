package io.github.jackhudsonn.jaakd.dto.auth;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;

public record ResendRegistrationRequest(@NotNull UUID registrationId) {
}
