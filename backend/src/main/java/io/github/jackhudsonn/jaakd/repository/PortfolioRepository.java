package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.jackhudsonn.jaakd.model.Portfolio;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PortfolioRepository extends JpaRepository<Portfolio, UUID> {

    List<Portfolio> findByProfileUserId(UUID userId);

    @Query("SELECT p FROM Portfolio p WHERE p.portfolioId = :portfolioId AND p.profile.userId = :userId")
    Optional<Portfolio> findOwnedByPortfolioId(
        @Param("portfolioId") UUID portfolioId,
        @Param("userId") UUID userId
    );
}
