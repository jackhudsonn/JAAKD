package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.jackhudsonn.jaakd.model.WatchlistItem;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WatchlistItemRepository extends JpaRepository<WatchlistItem, UUID> {

    List<WatchlistItem> findByPortfolioPortfolioId(UUID portfolioId);

    Optional<WatchlistItem> findByPortfolioPortfolioIdAndInstrumentInstrumentId(UUID portfolioId, UUID instrumentId);

    @Query("SELECT w FROM WatchlistItem w WHERE w.listItemId = :listItemId AND w.portfolio.profile.userId = :userId")
    Optional<WatchlistItem> findOwnedByListItemId(
        @Param("listItemId") UUID listItemId,
        @Param("userId") UUID userId
    );

    @Query("""
        SELECT w FROM WatchlistItem w
        WHERE w.portfolio.portfolioId = :portfolioId
            AND w.portfolio.profile.userId = :userId
        """)
    List<WatchlistItem> findOwnedByPortfolioId(
        @Param("portfolioId") UUID portfolioId,
        @Param("userId") UUID userId
    );

    @Query("""
        SELECT w FROM WatchlistItem w
        WHERE w.portfolio.portfolioId = :portfolioId
            AND w.instrument.instrumentId = :instrumentId
            AND w.portfolio.profile.userId = :userId
        """)
    Optional<WatchlistItem> findOwnedByPortfolioAndInstrument(
        @Param("portfolioId") UUID portfolioId,
        @Param("instrumentId") UUID instrumentId,
        @Param("userId") UUID userId
    );
}
