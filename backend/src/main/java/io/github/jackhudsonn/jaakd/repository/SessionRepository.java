package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import io.github.jackhudsonn.jaakd.model.Session;

import java.util.List;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {
    List<Session> findByUserIdAndSessionIdNot(UUID userId, UUID sessionId);

    void deleteByUserIdAndSessionIdNot(UUID userId, UUID sessionId);
}
