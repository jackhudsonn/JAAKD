package com.example.backend.repository;

import com.example.backend.model.WatchlistItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WatchlistItemRepository extends JpaRepository<WatchlistItem, UUID> {

    List<WatchlistItem> findByWatchListIdOrderByPriorityAsc(UUID watchListId);
}
