package io.github.jackhudsonn.jaakd.identity;

// Credential and session operations, independent of which provider backs them.
// The application owns sessions; the provider only verifies credentials.
public interface IdentityProvider {

    void register(String email, String password);

    SignInOutcome signIn(String email, String password);

    void changePassword(String email, String currentPassword, String newPassword);

    void signOut(String email);
}
