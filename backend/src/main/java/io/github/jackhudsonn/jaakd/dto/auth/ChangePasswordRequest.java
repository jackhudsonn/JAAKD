package io.github.jackhudsonn.jaakd.dto.auth;

import io.github.jackhudsonn.jaakd.validation.PasswordPolicy;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = PasswordPolicy.MIN_LENGTH) String newPassword) {
}
