package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.jackhudsonn.jaakd.model.Preference;

import java.util.Optional;
import java.util.UUID;

public interface PreferenceRepository extends JpaRepository<Preference, UUID> {

    @Query("SELECT p FROM Preference p WHERE p.portfolio.portfolioId = :portfolioId AND p.portfolio.profile.userId = :userId")
    Optional<Preference> findOwnedByPortfolioId(
        @Param("portfolioId") UUID portfolioId,
        @Param("userId") UUID userId
    );
}