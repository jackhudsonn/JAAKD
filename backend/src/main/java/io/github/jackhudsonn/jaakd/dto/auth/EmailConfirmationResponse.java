package io.github.jackhudsonn.jaakd.dto.auth;

// 202 response for a registration that is already pending confirmation.
public record EmailConfirmationResponse(String challenge, String email) {
}
