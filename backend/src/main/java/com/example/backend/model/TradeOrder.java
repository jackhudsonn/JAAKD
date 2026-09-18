package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

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

    @Column(name = "`instrumentID`", nullable = false)
    private UUID instrumentId;

    @Column(name = "side", nullable = false)
    @Enumerated(EnumType.STRING)
    private OrderSide side;

    @Column(name = "quantity")
    private double quantity;

    protected TradeOrder() {
    }

    public TradeOrder(UUID portfolioId, UUID instrumentId, OrderSide side) {
        this.portfolioId = portfolioId;
        this.instrumentId = instrumentId;
        this.side = side;
    }

    public UUID getOrderId() {
        return orderId;
    }

    public UUID getPortfolioId() {
        return portfolioId;
    }

    public double getQuantity() {
        return quantity;
    }

    public void setQuantity(double quantity) {
        this.quantity = quantity;
    }

    public OrderSide getSide() {
        return side;
    }

    public UUID getInstrumentId() {
        return instrumentId;
    }

}
