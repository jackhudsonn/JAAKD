package io.github.jackhudsonn.jaakd.validation;

// The application keeps only a syntactic floor. Password strength is owned by
// the configured identity provider's user pool, so development and production
// can differ without an environment branch in code.
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 6;
    public static final int MAX_LENGTH = 99;

    private PasswordPolicy() {
    }
}
