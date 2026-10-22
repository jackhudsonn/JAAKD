package io.github.jackhudsonn.jaakd.dto.auth;

import java.util.UUID;

// "REGISTERED" is the development provider, where no confirmation step exists.
// "CONFIRMATION_REQUIRED" is Cognito before the email code is entered.
public record RegistrationResponse(RegistrationStatus status, String email, UUID registrationId) {
}
