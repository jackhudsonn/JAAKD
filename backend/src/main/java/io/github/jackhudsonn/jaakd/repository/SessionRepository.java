package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import io.github.jackhudsonn.jaakd.model.Session;

import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {
    void deleteByUserIdAndSessionIdNot(UUID userId, UUID sessionId);
}
