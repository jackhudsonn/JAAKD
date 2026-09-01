package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

// Maps to public.holdings — the positions table. Ticker moved out to instruments; holdings now references instrumentID.
@Entity
@Table(name = "holdings")
public class Holding {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`holdingID`")
    private UUID holdingId;

    @Column(name = "`portfolioID`", nullable = false)
    private UUID portfolioId;

    @Column(name = "quantity", nullable = false)
    private Long quantity = 0L;

    @Column(name = "cost", nullable = false)
    private Double cost = 0.0;

    @Column(name = "`instrumentID`", nullable = false)
    private UUID instrumentId;

    protected Holding() {
    }

    public Holding(UUID portfolioId, UUID instrumentId) {
        this.portfolioId = portfolioId;
        this.instrumentId = instrumentId;
    }

    public UUID getHoldingId() {
        return holdingId;
    }

    public UUID getPortfolioId() {
        return portfolioId;
    }

    public Long getQuantity() {
        return quantity;
    }

    public void setQuantity(Long quantity) {
        this.quantity = quantity;
    }

    public Double getCost() {
        return cost;
    }

    public void setCost(Double cost) {
        this.cost = cost;
    }

    public UUID getInstrumentId() {
        return instrumentId;
    }
}
