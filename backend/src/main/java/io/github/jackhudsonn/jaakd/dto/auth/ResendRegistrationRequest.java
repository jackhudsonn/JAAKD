package io.github.jackhudsonn.jaakd.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ResendRegistrationRequest(@NotBlank @Email String email) {
}
