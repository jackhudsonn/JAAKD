package io.github.jackhudsonn.jaakd.exception;

public class EmailAlreadyRegisteredException extends RuntimeException {

    public EmailAlreadyRegisteredException() {
        super("email already registered");
    }
}
