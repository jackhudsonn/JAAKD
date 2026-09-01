package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// Maps to public.orders (named TradeOrder to avoid confusion with the SQL keyword / java.util types).
// `side` is now free-text (was boolean) — convention (e.g. "buy"/"sell") needs reconfirming after this schema change.
@Entity
@Table(name = "orders")
public class TradeOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`orderID`")
    private UUID orderId;

    @Column(name = "`portfolioID`", nullable = false)
    private UUID portfolioId;

    @Column(name = "quantity", nullable = false)
    private Long quantity;

    @Column(name = "`initTime`", nullable = false)
    private Instant initTime;

    @Column(name = "side")
    private String side;

    @Column(name = "`initPrice`", nullable = false)
    private Double initPrice;

    @Column(name = "`instrumentID`")
    private UUID instrumentId;

    protected TradeOrder() {
    }

    public TradeOrder(UUID portfolioId, Long quantity, Double initPrice) {
        this.portfolioId = portfolioId;
        this.quantity = quantity;
        this.initPrice = initPrice;
    }

    public UUID getOrderId() {
        return orderId;
    }

    public UUID getPortfolioId() {
        return portfolioId;
    }

    public Long getQuantity() {
        return quantity;
    }

    public Instant getInitTime() {
        return initTime;
    }

    public String getSide() {
        return side;
    }

    public void setSide(String side) {
        this.side = side;
    }

    public Double getInitPrice() {
        return initPrice;
    }

    public UUID getInstrumentId() {
        return instrumentId;
    }

    public void setInstrumentId(UUID instrumentId) {
        this.instrumentId = instrumentId;
    }
}
