package io.github.jackhudsonn.jaakd.exception;

// Registration already exists but the email has not been confirmed.
public class ConfirmationPendingException extends RuntimeException {

    private final String email;

    public ConfirmationPendingException(String email) {
        super("registration confirmation is pending");
        this.email = email;
    }

    public String getEmail() {
        return email;
    }
}
