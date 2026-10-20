package io.github.jackhudsonn.jaakd.repository;

import io.github.jackhudsonn.jaakd.model.Watchlist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WatchlistRepository extends JpaRepository<Watchlist, UUID> {

    List<Watchlist> findByUserUserIdOrderByWatchlistIdAsc(UUID userId);

    Optional<Watchlist> findByWatchlistIdAndUserUserId(UUID watchlistId, UUID userId);

    boolean existsByUserUserIdAndWatchlistName(UUID userId, String watchlistName);

    boolean existsByUserUserIdAndWatchlistNameAndWatchlistIdNot(
        UUID userId,
        String watchlistName,
        UUID watchlistId
    );

    long countByUserUserId(UUID userId);
}
