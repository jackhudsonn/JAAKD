package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

// Maps to public."watchListItem".
@Entity
@Table(name = "`watchListItem`")
public class WatchlistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`listItemID`")
    private UUID listItemId;

    @Column(name = "`watchListID`", nullable = false)
    private UUID watchListId;

    @Column(name = "ticker", nullable = false)
    private String ticker;

    @Column(name = "priority", nullable = false)
    private Long priority;

    protected WatchlistItem() {
    }

    public WatchlistItem(UUID watchListId, String ticker, Long priority) {
        this.watchListId = watchListId;
        this.ticker = ticker;
        this.priority = priority;
    }

    public UUID getListItemId() {
        return listItemId;
    }

    public UUID getWatchListId() {
        return watchListId;
    }

    public String getTicker() {
        return ticker;
    }

    public Long getPriority() {
        return priority;
    }

    public void setPriority(Long priority) {
        this.priority = priority;
    }
}
