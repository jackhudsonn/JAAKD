package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// Maps to public."holdingID" — the positions table (table is literally named after its PK column).
@Entity
@Table(name = "`holdingID`")
public class Holding {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`holdingID`")
    private UUID holdingId;

    @Column(name = "`portfolioID`", nullable = false)
    private UUID portfolioId;

    @Column(name = "ticker", nullable = false)
    private String ticker;

    @Column(name = "quantity", nullable = false)
    private Long quantity = 0L;

    @Column(name = "`avgCost`", nullable = false)
    private Double avgCost = 0.0;

    @Column(name = "`lastUpdate`", nullable = false)
    private Instant lastUpdate;

    protected Holding() {
    }

    public Holding(UUID portfolioId, String ticker) {
        this.portfolioId = portfolioId;
        this.ticker = ticker;
    }

    public UUID getHoldingId() {
        return holdingId;
    }

    public UUID getPortfolioId() {
        return portfolioId;
    }

    public String getTicker() {
        return ticker;
    }

    public Long getQuantity() {
        return quantity;
    }

    public void setQuantity(Long quantity) {
        this.quantity = quantity;
    }

    public Double getAvgCost() {
        return avgCost;
    }

    public void setAvgCost(Double avgCost) {
        this.avgCost = avgCost;
    }

    public Instant getLastUpdate() {
        return lastUpdate;
    }

    public void setLastUpdate(Instant lastUpdate) {
        this.lastUpdate = lastUpdate;
    }
}
