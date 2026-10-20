package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import io.github.jackhudsonn.jaakd.model.WatchlistItem;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WatchlistItemRepository extends JpaRepository<WatchlistItem, UUID> {

    List<WatchlistItem> findByWatchlistWatchlistIdInOrderByListItemIdAsc(List<UUID> watchlistIds);

    Optional<WatchlistItem> findByWatchlistWatchlistIdAndInstrumentInstrumentId(UUID watchlistId, UUID instrumentId);

    Optional<WatchlistItem> findByListItemIdAndWatchlistWatchlistIdAndWatchlistUserUserId(
        UUID listItemId,
        UUID watchlistId,
        UUID userId
    );
}
