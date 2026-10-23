package io.github.jackhudsonn.jaakd.exception;

// The provider identity exists but the application-side registration rows do
// not. The user must retry registration or an operator must clean up the
// orphaned provider user.
public class RegistrationIncompleteException extends RuntimeException {

    public RegistrationIncompleteException() {
        super("registration is incomplete; please retry registration");
    }
}
