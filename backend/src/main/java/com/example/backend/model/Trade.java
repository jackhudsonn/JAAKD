package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "trades")
public class Trade {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`tradeID`")
    private UUID tradeID;

    @Column(name = "porfolioID", nullable = false)
    private UUID portfolioID;

    @Column(name = "orderLogID", nullable = false)
    private UUID orderLogID;

    protected Trade() {
    }

    public Trade(UUID orderLogId, UUID portfolioId) {
        this.portfolioID = portfolioId;
        this.orderLogID = orderLogId;
    }

    public UUID getOrderLogID() {
        return orderLogID;
    }

    public UUID getPortfolioID() {
        return portfolioID;
    }
}
