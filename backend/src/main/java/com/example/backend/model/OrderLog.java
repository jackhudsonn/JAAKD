package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.ZonedDateTime;
import java.util.UUID;

// Maps to public.orders (named TradeOrder to avoid confusion with the SQL keyword / java.util types).
// `side` is now free-text (was boolean) — convention (e.g. "buy"/"sell") needs reconfirming after this schema change.
@Entity
@Table(name = "orderLogs")
public class OrderLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`logOrderID`")
    private UUID logOrderID;

    @Column(name = "orderID", nullable = false)
    private UUID orderID;

    @Column(name = "`portfolioID`", nullable = false)
    private UUID portfolioID;

    @Column(name = "`instrumentID`", nullable = false)
    private UUID instrumentID;

    @Column(name = "side", nullable = false)
    @Enumerated(EnumType.STRING)
    private OrderSide side;

    @Column(name = "quantity", nullable = false)
    private double quantity;

    @Column(name = "timestamp", nullable = false)
    private ZonedDateTime timestamp;

    @Column(name = "metadata")
    private String metadata;

    protected OrderLog() {
    }

    public OrderLog(UUID orderId, UUID portfolioId, UUID instrumentId, OrderSide side, double quantity) {
        this.portfolioID = portfolioId;
        this.orderID = orderId;
        this.instrumentID = instrumentId;
        this.side = side;
        this.quantity = quantity;
        this.timestamp = ZonedDateTime.now();
    }

    public UUID getOrderId() {
        return orderID;
    }

    public UUID getPortfolioId() {
        return portfolioID;
    }

    public double getQuantity() {
        return quantity;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public ZonedDateTime getTimeStamp() {
        return timestamp;
    }

    public OrderSide getSide() {
        return side;
    }

    public UUID getInstrumentId() {
        return instrumentID;
    }

}
