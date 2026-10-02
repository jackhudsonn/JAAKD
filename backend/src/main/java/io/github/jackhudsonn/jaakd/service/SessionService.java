package io.github.jackhudsonn.jaakd.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.jackhudsonn.jaakd.model.Session;
import io.github.jackhudsonn.jaakd.repository.SessionRepository;
import io.github.jackhudsonn.jaakd.repository.UserRepository;
import io.github.jackhudsonn.jaakd.security.AuthenticatedUser;

@Service
public class SessionService {

    private final SessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final Clock clock;
    private final Duration ttl;

    public SessionService(SessionRepository sessionRepository, UserRepository userRepository, Clock clock,
            @Value("${auth.session.ttl:PT8H}") Duration ttl) {
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.clock = clock;
        this.ttl = ttl;
    }

    @Transactional
    public Session create(UUID userId, String refreshToken) {
        Instant createdAt = Instant.now(clock);
        Session session = new Session(userId, refreshToken, createdAt, createdAt.plus(ttl));
        return sessionRepository.save(session);
    }

    // Resolves a session cookie to the authenticated user, or empty when the
    // session is unknown or expired.
    public Optional<AuthenticatedUser> resolve(UUID sessionId) {
        Instant now = Instant.now(clock);

        return sessionRepository.findById(sessionId)
                .filter(session -> !session.isExpired(now))
                .flatMap(session -> userRepository.findById(session.getUserId()))
                .map(user -> new AuthenticatedUser(user.getUserId(), user.getEmail()));
    }

    @Transactional
    public void delete(UUID sessionId) {
        sessionRepository.deleteById(sessionId);
    }

    // Ends every session for the user except the one making the request, so a
    // password change signs out other devices without ending the caller's.
    @Transactional
    public void revokeOtherSessions(UUID userId, UUID currentSessionId) {
        sessionRepository.deleteByUserIdAndSessionIdNot(userId, currentSessionId);
    }

    public Duration ttl() {
        return ttl;
    }
}
