package io.github.jackhudsonn.jaakd.identity;

import java.util.UUID;

// Credential and session operations, independent of which provider backs them.
// The application owns users and sessions; the provider only verifies
// credentials and owns its own identity records.
public interface IdentityProvider {

    RegistrationOutcome register(UUID userId, String email, String password);

    // Records the provider identity link for an application user. Providers
    // without a separate link table no-op this.
    void link(UUID userId, String subject, String email);

    void confirmRegistration(String email, String code);

    void resendConfirmation(String email);

    SignInOutcome signIn(String email, String password);

    void changePassword(String email, String currentPassword, String newPassword);

    // Best-effort provider-side revocation. Implementations must not make this
    // a failure path for the caller.
    void revoke(String refreshToken);
}
