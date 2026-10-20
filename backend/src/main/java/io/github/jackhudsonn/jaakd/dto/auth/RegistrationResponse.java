package io.github.jackhudsonn.jaakd.dto.auth;

// "REGISTERED" is the development provider, where no confirmation step exists.
// "CONFIRMATION_REQUIRED" is Cognito before the email code is entered.
public record RegistrationResponse(String status, String email) {
}
