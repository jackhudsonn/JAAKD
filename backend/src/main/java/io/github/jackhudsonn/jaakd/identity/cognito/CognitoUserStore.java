package io.github.jackhudsonn.jaakd.identity.cognito;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "identity.provider", havingValue = "cognito")
public class CognitoUserStore {

    private static final Duration PENDING_TTL = Duration.ofDays(7);

    private final CognitoUserRepository repository;

    public CognitoUserStore(CognitoUserRepository repository) {
        this.repository = repository;
    }

    public Optional<CognitoUser> findBySubject(String subject) {
        return repository.findBySubject(subject);
    }

    public Optional<CognitoUser> findByUserId(UUID userId) {
        return repository.findByUserId(userId);
    }

    public Optional<CognitoUser> findConfirmedByEmail(String email) {
        return repository.findByEmailAndStatus(email, CognitoUserStatus.CONFIRMED)
                .stream()
                .findFirst();
    }

    public Optional<CognitoUser> findLatestPendingByEmail(String email) {
        return repository.findByEmailAndStatus(email, CognitoUserStatus.PENDING)
                .stream()
                .findFirst();
    }

    public void insertPending(UUID userId, String subject, String signUpSession) {
        if (repository.findBySubject(subject).isPresent()) {
            return;
        }

        Instant now = Instant.now();
        repository.save(new CognitoUser(UUID.randomUUID(), userId, subject, CognitoUserStatus.PENDING,
                signUpSession, now, now.plus(PENDING_TTL)));
    }

    public void markConfirmed(UUID identityId) {
        repository.markConfirmed(identityId, CognitoUserStatus.CONFIRMED);
    }

    public void markConfirmed(String subject) {
        repository.markConfirmedBySubject(subject, CognitoUserStatus.CONFIRMED);
    }
}
