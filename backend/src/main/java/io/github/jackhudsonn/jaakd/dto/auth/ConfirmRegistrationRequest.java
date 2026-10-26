package io.github.jackhudsonn.jaakd.dto.auth;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ConfirmRegistrationRequest(
        @NotNull UUID registrationId,
        @NotBlank String code) {
}
