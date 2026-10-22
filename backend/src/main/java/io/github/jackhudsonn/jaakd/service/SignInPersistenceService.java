package io.github.jackhudsonn.jaakd.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.jackhudsonn.jaakd.identity.SignInOutcome;
import io.github.jackhudsonn.jaakd.model.Session;

// Persists the application-side result of a provider sign-in as one transaction.
@Service
public class SignInPersistenceService {

    private final UserProvisioner userProvisioner;
    private final SessionService sessionService;

    public SignInPersistenceService(UserProvisioner userProvisioner, SessionService sessionService) {
        this.userProvisioner = userProvisioner;
        this.sessionService = sessionService;
    }

    @Transactional
    public SignInResult create(SignInOutcome.Authenticated authenticated) {
        userProvisioner.ensureUser(authenticated.userId(), authenticated.email());
        Session session = sessionService.create(authenticated.userId(), authenticated.refreshToken());
        return new SignInResult(session, authenticated.email());
    }
}
