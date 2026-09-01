package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

// Maps to public.portfolio. No unique constraint on userID — multiple portfolios per user are already possible.
@Entity
@Table(name = "portfolio")
public class Portfolio {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`portfolioID`")
    private UUID portfolioId;

    @Column(name = "`cashHoldings`", nullable = false)
    private Double cashHoldings = 0.0;

    @Column(name = "`userID`")
    private UUID userId;

    protected Portfolio() {
    }

    public Portfolio(UUID userId) {
        this.userId = userId;
    }

    public UUID getPortfolioId() {
        return portfolioId;
    }

    public Double getCashHoldings() {
        return cashHoldings;
    }

    public void setCashHoldings(Double cashHoldings) {
        this.cashHoldings = cashHoldings;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }
}
