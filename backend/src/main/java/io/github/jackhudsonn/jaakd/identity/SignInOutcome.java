package io.github.jackhudsonn.jaakd.identity;

import java.util.UUID;

public sealed interface SignInOutcome {

    record Authenticated(UUID userId, String email) implements SignInOutcome {
    }

    record Challenge(String continuation, String type) implements SignInOutcome {
    }
}
