package io.github.jackhudsonn.jaakd.identity.cognito;

import java.time.Instant;
import java.util.UUID;

import io.github.jackhudsonn.jaakd.model.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

// Adapter-owned link between a Cognito subject and an application user.
@Entity
@Table(name = "cognito_users")
public class CognitoUser {

    @Id
    @Column(name = "`identityID`")
    private UUID identityId;

    @Column(name = "`userID`", nullable = false, unique = true)
    private UUID userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "`userID`", referencedColumnName = "`userID`", insertable = false, updatable = false)
    private User user;

    @Column(name = "subject", nullable = false, unique = true)
    private String subject;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private CognitoUserStatus status;

    @Column(name = "`signUpSession`")
    private String signUpSession;

    @Column(name = "`createdAt`", nullable = false)
    private Instant createdAt;

    @Column(name = "`expiresAt`")
    private Instant expiresAt;

    protected CognitoUser() {
    }

    public CognitoUser(UUID identityId, UUID userId, String subject, CognitoUserStatus status,
            String signUpSession, Instant createdAt, Instant expiresAt) {
        this.identityId = identityId;
        this.userId = userId;
        this.subject = subject;
        this.status = status;
        this.signUpSession = signUpSession;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public UUID getIdentityId() {
        return identityId;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getSubject() {
        return subject;
    }

    public CognitoUserStatus getStatus() {
        return status;
    }

    public String getSignUpSession() {
        return signUpSession;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }
}
