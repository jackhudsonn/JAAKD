package io.github.jackhudsonn.jaakd.service;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.jackhudsonn.jaakd.exception.ChallengeRequiredException;
import io.github.jackhudsonn.jaakd.identity.IdentityProvider;
import io.github.jackhudsonn.jaakd.identity.SignInOutcome;
import io.github.jackhudsonn.jaakd.model.Session;

@Service
public class AuthService {

    private final IdentityProvider identityProvider;
    private final UserProvisioner userProvisioner;
    private final SessionService sessionService;

    public AuthService(IdentityProvider identityProvider, UserProvisioner userProvisioner,
            SessionService sessionService) {
        this.identityProvider = identityProvider;
        this.userProvisioner = userProvisioner;
        this.sessionService = sessionService;
    }

    public void register(String email, String password) {
        identityProvider.register(email, password);
    }

    @Transactional
    public SignInResult signIn(String email, String password) {
        SignInOutcome outcome = identityProvider.signIn(email, password);

        return switch (outcome) {
            case SignInOutcome.Authenticated authenticated -> {
                userProvisioner.ensureUser(authenticated.userId(), authenticated.email());
                Session session = sessionService.create(authenticated.userId(), null);
                yield new SignInResult(session, authenticated.email());
            }
            case SignInOutcome.Challenge challenge -> throw new ChallengeRequiredException(
                    challenge.continuation(), challenge.type());
        };
    }

    public void changePassword(String email, String currentPassword, String newPassword) {
        identityProvider.changePassword(email, currentPassword, newPassword);
    }

    public void signOut(UUID sessionId) {
        sessionService.delete(sessionId);
    }
}
