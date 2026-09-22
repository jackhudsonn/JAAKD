package com.example.backend.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.util.List;
import java.util.UUID;

// Maps to public.portfolios. No unique constraint on userID — multiple portfolios per user are already possible.
@Entity
@Table(name = "portfolios")
public class Portfolio {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`portfolioID`")
    private UUID portfolioId;

    @ManyToOne
    @JoinColumn(name = "`userID`", nullable = false)
    private Profile profile;

    @Column(name = "portfolioName")
    private String portfolioName;

    @OneToMany(mappedBy = "portfolio", cascade = CascadeType.REMOVE, orphanRemoval = true)
    private List<Holding> holdings;

    @OneToMany(mappedBy = "portfolio")
    private List<OrderLog> orderLogs;

    @OneToMany(mappedBy = "portfolio", cascade = CascadeType.REMOVE, orphanRemoval = true)
    private List<WatchlistItem> watchlistItems;

    protected Portfolio() {
    }

    public Portfolio(Profile profile) {
        this.profile = profile;
    }

    public UUID getPortfolioId() {
        return portfolioId;
    }

    public Profile getProfile() {
        return profile;
    }
    
    public List<Holding> getHoldings() {
        return holdings;
    }

    public void addHolding(Holding holding) {
        if (holdings != null) {
            holdings.add(holding);
        }
    }

    public void removeHolding(Holding holding) {
        if (holdings != null) {
            holdings.remove(holding);
        }
    }

    public List<OrderLog> getOrderLogs() {
        return orderLogs;
    }

    public List<WatchlistItem> getWatchlistItems() {
        return watchlistItems;
    }

    public String getPortfolioName() {
        return portfolioName;
    }

    public void setPortfolioName(String portfolioName) {
        this.portfolioName = portfolioName;
    }
}
