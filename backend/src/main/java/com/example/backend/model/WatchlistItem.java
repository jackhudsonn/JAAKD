package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

// Maps to public.watchlist_items. Ticker moved out to instruments; now references instrumentID.
@Entity
@Table(name = "watchlist_items")
public class WatchlistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`listItemID`")
    private UUID listItemId;

    @Column(name = "`watchListID`", nullable = false)
    private UUID watchListId;

    @Column(name = "`instrumentID`", nullable = false)
    private UUID instrumentId;

    @Column(name = "priority", nullable = false)
    private Long priority;

    protected WatchlistItem() {
    }

    public WatchlistItem(UUID watchListId, UUID instrumentId, Long priority) {
        this.watchListId = watchListId;
        this.instrumentId = instrumentId;
        this.priority = priority;
    }

    public UUID getListItemId() {
        return listItemId;
    }

    public UUID getWatchListId() {
        return watchListId;
    }

    public UUID getInstrumentId() {
        return instrumentId;
    }

    public Long getPriority() {
        return priority;
    }

    public void setPriority(Long priority) {
        this.priority = priority;
    }
}
