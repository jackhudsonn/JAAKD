package io.github.jackhudsonn.jaakd.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// Maps to public.sessions: server-side session state for cookie-based auth.
// The browser holds only the opaque sessionID; provider tokens stay here.
// Per-user attributes (email) live on the user, not duplicated per session.
@Entity
@Table(name = "sessions")
public class Session {

    @Id
    @Column(name = "`sessionID`")
    private UUID sessionId;

    @Column(name = "`userID`", nullable = false)
    private UUID userId;

    // The identity provider's refresh token, kept server-side so the backend
    // can renew access without involving the browser. Null for providers that
    // do not issue one (the development provider).
    @Column(name = "`refreshToken`")
    private String refreshToken;

    @Column(name = "`createdAt`", nullable = false)
    private Instant createdAt;

    @Column(name = "`expiresAt`", nullable = false)
    private Instant expiresAt;

    protected Session() {
    }

    public Session(UUID userId, String refreshToken, Instant createdAt, Instant expiresAt) {
        this.sessionId = UUID.randomUUID();
        this.userId = userId;
        this.refreshToken = refreshToken;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public boolean isExpired(Instant now) {
        return expiresAt.isBefore(now);
    }

    public UUID getSessionId() {
        return sessionId;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }
}
