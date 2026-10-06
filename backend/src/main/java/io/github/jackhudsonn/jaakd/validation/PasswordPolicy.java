package io.github.jackhudsonn.jaakd.validation;

// Password rules in one place. Today it is only a minimum length, so a
// constant suffices; if character rules are added, replace this with a custom
// constraint (for example @ValidPassword) so every request type stays in sync.
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;

    private PasswordPolicy() {
    }
}
