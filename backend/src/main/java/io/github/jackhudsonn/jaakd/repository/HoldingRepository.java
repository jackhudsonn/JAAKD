package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.jackhudsonn.jaakd.model.Holding;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HoldingRepository extends JpaRepository<Holding, UUID> {

    List<Holding> findByPortfolioPortfolioId(UUID portfolioId);

    Optional<Holding> findByPortfolioPortfolioIdAndInstrumentInstrumentId(UUID portfolioId, UUID instrumentId);

    Optional<Holding> findByHoldingIdAndPortfolioProfileUserId(UUID holdingId, UUID userId);

        @Query("SELECT h FROM Holding h WHERE h.portfolio.portfolioId = :portfolioId AND h.instrument.instrumentId = :instrumentId AND h.portfolio.profile.userId = :userId")
        Optional<Holding> findOwnedByPortfolioAndInstrument(
            @Param("portfolioId") UUID portfolioId,
            @Param("instrumentId") UUID instrumentId,
            @Param("userId") UUID userId
        );

    List<Holding> findByPortfolioPortfolioIdAndPortfolioProfileUserId(UUID portfolioId, UUID userId);
}
