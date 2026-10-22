package io.github.jackhudsonn.jaakd.identity;

import java.util.Optional;
import java.util.UUID;

// Credential and session operations, independent of which provider backs them.
// The application owns users and sessions; the provider only verifies
// credentials and owns its own identity records.
public interface IdentityProvider {

    RegistrationOutcome register(UUID userId, String email, String password);

    // Records the provider identity link for an application user. Providers
    // without a separate link table no-op this.
    void link(UUID userId, String subject, String signUpSession);

    // Confirms email ownership. Returns an authenticated outcome when the
    // provider can complete sign-in from the confirmation session; otherwise
    // the user must sign in normally.
    Optional<SignInOutcome.Authenticated> confirmRegistration(String email, String code);

    void resendConfirmation(String email);

    SignInOutcome signIn(String email, String password);

    void changePassword(String email, String currentPassword, String newPassword);

    // Best-effort provider-side revocation. Implementations must not make this
    // a failure path for the caller.
    void revoke(String refreshToken);
}
