package io.github.jackhudsonn.jaakd.dto.auth;

import io.github.jackhudsonn.jaakd.validation.PasswordPolicy;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = PasswordPolicy.MIN_LENGTH) String password) {
}
