package io.github.jackhudsonn.jaakd.security;

import java.util.UUID;

// Identity of the authenticated caller, resolved from the server-side session.
public record AuthenticatedUser(UUID userId, String email) {
}
