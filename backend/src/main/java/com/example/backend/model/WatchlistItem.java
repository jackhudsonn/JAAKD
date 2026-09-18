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

     @Column(name = "`portfolioID`", nullable = false)
    private UUID portfolioId;

    @Column(name = "`instrumentID`", nullable = false)
    private UUID instrumentId;

    @Column(name = "name")
    private String name;

    protected WatchlistItem() {
    }

    public WatchlistItem(UUID portfolioId, UUID instrumentId) {
        this.portfolioId = portfolioId;
        this.instrumentId = instrumentId;
    }

    public UUID getPortfolioId() {
        return portfolioId;
    }

    public UUID getInstrumentId() {
        return instrumentId;
    }

    public String getWatchListName() {
        return name;
    }

    public void setWatchListName( String name ) {
        this.name = name;
    }
}
