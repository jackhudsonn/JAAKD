package io.github.jackhudsonn.jaakd.exception;

// The provider verified the credentials but the email address is not confirmed.
public class EmailNotConfirmedException extends RuntimeException {

    private final String email;

    public EmailNotConfirmedException(String email) {
        super("email address is not confirmed");
        this.email = email;
    }

    public String getEmail() {
        return email;
    }
}
