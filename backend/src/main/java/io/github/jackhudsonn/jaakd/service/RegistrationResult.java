package io.github.jackhudsonn.jaakd.service;

import java.util.UUID;

// Result of creating a credential and its application-side rows.
public record RegistrationResult(String email, boolean confirmationRequired, UUID registrationId) {
}
