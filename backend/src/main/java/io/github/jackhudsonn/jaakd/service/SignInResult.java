package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.model.Session;

// Result of a successful sign-in: the new session plus the provider's email,
// which the API echoes back for display.
public record SignInResult(Session session, String email) {
}
