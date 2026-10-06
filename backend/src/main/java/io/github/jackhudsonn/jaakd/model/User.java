package io.github.jackhudsonn.jaakd.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// Maps to public.users: the application's provider-neutral identity anchor.
// Credentials are never stored here; they live with the identity provider.
// `email` is the identity attribute the application needs before a profile
// exists, refreshed from the provider at each sign-in.
@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(name = "`userID`")
    private UUID userId;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "`createdAt`", nullable = false)
    private Instant createdAt;

    protected User() {
    }

    public User(UUID userId, String email, Instant createdAt) {
        this.userId = userId;
        this.email = email;
        this.createdAt = createdAt;
    }

    @PrePersist
    void prePersist() {
        if (userId == null) {
            userId = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getUserId() {
        return userId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
