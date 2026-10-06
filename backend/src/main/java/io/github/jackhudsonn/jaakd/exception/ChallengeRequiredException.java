package io.github.jackhudsonn.jaakd.exception;

// Raised when the identity provider requires another step (MFA, new password,
// email confirmation). The controller relays it to the client as 202.
public class ChallengeRequiredException extends RuntimeException {

    private final String continuation;
    private final String type;

    public ChallengeRequiredException(String continuation, String type) {
        super("additional authentication required");
        this.continuation = continuation;
        this.type = type;
    }

    public String getContinuation() {
        return continuation;
    }

    public String getType() {
        return type;
    }
}
