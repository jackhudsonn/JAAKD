package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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

    @ManyToOne
    @JoinColumn(name = "`portfolioID`", nullable = false)
    private Portfolio portfolio;

    @ManyToOne
    @JoinColumn(name = "`instrumentID`", nullable = false)
    private Instrument instrument;

    @Column(name = "name")
    private String name;

    protected WatchlistItem() {
    }

    public WatchlistItem(Portfolio portfolio, Instrument instrument) {
        this.portfolio = portfolio;
        this.instrument = instrument;
    }

    public Portfolio getPortfolio() {
        return portfolio;
    }

    public Instrument getInstrument() {
        return instrument;
    }

    public String getWatchListName() {
        return name;
    }

    public void setWatchListName( String name ) {
        this.name = name;
    }
}
