package io.github.jackhudsonn.jaakd.repository;

import io.github.jackhudsonn.jaakd.model.Watchlist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WatchlistRepository extends JpaRepository<Watchlist, UUID> {

    List<Watchlist> findByPortfolioPortfolioIdOrderByWatchlistIdAsc(UUID portfolioId);

    Optional<Watchlist> findByWatchlistIdAndPortfolioPortfolioIdAndPortfolioProfileUserId(
        UUID watchlistId,
        UUID portfolioId,
        UUID userId
    );

    boolean existsByPortfolioPortfolioIdAndWatchlistName(UUID portfolioId, String watchlistName);

    boolean existsByPortfolioPortfolioIdAndWatchlistNameAndWatchlistIdNot(
        UUID portfolioId,
        String watchlistName,
        UUID watchlistId
    );

    long countByPortfolioPortfolioId(UUID portfolioId);
}
