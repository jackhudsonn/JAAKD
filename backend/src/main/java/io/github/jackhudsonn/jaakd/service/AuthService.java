package io.github.jackhudsonn.jaakd.service;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import io.github.jackhudsonn.jaakd.dto.CreateProfileRequest;
import io.github.jackhudsonn.jaakd.exception.ChallengeRequiredException;
import io.github.jackhudsonn.jaakd.identity.IdentityProvider;
import io.github.jackhudsonn.jaakd.identity.RegistrationOutcome;
import io.github.jackhudsonn.jaakd.identity.SignInOutcome;
import io.github.jackhudsonn.jaakd.model.Session;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final IdentityProvider identityProvider;
    private final UserProvisioner userProvisioner;
    private final SessionService sessionService;
    private final RegistrationService registrationService;

    public AuthService(IdentityProvider identityProvider, UserProvisioner userProvisioner,
            SessionService sessionService, RegistrationService registrationService) {
        this.identityProvider = identityProvider;
        this.userProvisioner = userProvisioner;
        this.sessionService = sessionService;
        this.registrationService = registrationService;
    }

    // Deliberately not transactional: the provider call may be a network round
    // trip, so it must not sit inside a database transaction. The application
    // rows are written atomically after the provider accepts the registration.
    public RegistrationResult register(String email, String password, CreateProfileRequest profile) {
        UUID userId = UUID.randomUUID();
        RegistrationOutcome outcome = identityProvider.register(userId, email, password);
        try {
            registrationService.persistRegistration(userId, email, profile, outcome);
        } catch (RuntimeException ex) {
            // The provider user now exists without its application rows. Do not
            // auto-delete it; record the subject for manual cleanup.
            log.error("Registration persistence failed for provider subject {}", outcome.subject(), ex);
            throw ex;
        }
        return new RegistrationResult(email, outcome.confirmationRequired());
    }

    public void confirmRegistration(String email, String code) {
        identityProvider.confirmRegistration(email, code);
    }

    public void resendConfirmation(String email) {
        identityProvider.resendConfirmation(email);
    }

    // Deliberately not transactional: the provider call may be a network round
    // trip, so it must not sit inside a database transaction. Provisioning and
    // session creation each open their own transaction.
    public SignInResult signIn(String email, String password) {
        SignInOutcome outcome = identityProvider.signIn(email, password);

        return switch (outcome) {
            case SignInOutcome.Authenticated authenticated -> {
                userProvisioner.ensureUser(authenticated.userId(), authenticated.email());
                Session session = sessionService.create(authenticated.userId(), authenticated.refreshToken());
                yield new SignInResult(session, authenticated.email());
            }
            case SignInOutcome.Challenge challenge -> throw new ChallengeRequiredException(
                    challenge.continuation(), challenge.type());
        };
    }

    // The provider changes the credential outside any transaction; only the
    // session revocation that follows is transactional. If revocation fails
    // after a successful change, the password is changed but other sessions
    // remain until they expire; there is no cross-system transaction to prevent
    // that window.
    public void changePassword(UUID userId, UUID currentSessionId, String email, String currentPassword,
            String newPassword) {
        identityProvider.changePassword(email, currentPassword, newPassword);

        for (Session otherSession : sessionService.findOtherSessions(userId, currentSessionId)) {
            try {
                identityProvider.revoke(otherSession.getRefreshToken());
            } catch (RuntimeException ex) {
                log.warn("Provider token revocation failed for a session; deleting it locally", ex);
            }
        }
        sessionService.revokeOtherSessions(userId, currentSessionId);
    }

    // Best-effort provider revocation, then the local session is deleted. The
    // provider session and the application session have independent lifetimes,
    // but logout should not leave a live refresh token behind.
    public void signOut(UUID sessionId) {
        sessionService.find(sessionId).ifPresent(session -> {
            try {
                identityProvider.revoke(session.getRefreshToken());
            } catch (RuntimeException ex) {
                log.warn("Provider token revocation failed during logout", ex);
            } finally {
                sessionService.delete(sessionId);
            }
        });
    }
}
