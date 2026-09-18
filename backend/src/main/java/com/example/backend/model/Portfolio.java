package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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

    @Column(name = "`userID`", nullable = false)
    private UUID userId;

    @Column(name = "portfolioName")
    private String portfolioName;

    private List<Holding> holdings;

    protected Portfolio() {
    }

    public Portfolio(UUID userId) {
        this.userId = userId;
    }

    public UUID getPortfolioId() {
        return portfolioId;
    }

    public UUID getUserId() {
        return userId;
    }
    
    public List<Holding> getHoldings() {
        return holdings;
    }

    public void setPortfolioName(String portfolioName) {
        this.portfolioName = portfolioName;
    }
}
