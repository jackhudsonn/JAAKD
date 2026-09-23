package com.example.backend.repository;

import com.example.backend.model.WatchlistItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WatchlistItemRepository extends JpaRepository<WatchlistItem, UUID> {

    List<WatchlistItem> findByPortfolioPortfolioId(UUID portfolioId);

    Optional<WatchlistItem> findByPortfolioPortfolioIdAndInstrumentInstrumentId(UUID portfolioId, UUID instrumentId);

    Optional<WatchlistItem> findByListItemIdAndPortfolioProfileUserId(UUID listItemId, UUID userId);

    List<WatchlistItem> findByPortfolioPortfolioIdAndPortfolioProfileUserId(UUID portfolioId, UUID userId);

    Optional<WatchlistItem> findByPortfolioPortfolioIdAndInstrumentInstrumentIdAndPortfolioProfileUserId(
            UUID portfolioId,
            UUID instrumentId,
            UUID userId
    );
}
