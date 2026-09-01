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
// `side` is a raw boolean in the live schema — buy/sell convention must be agreed and enforced in the service layer.
@Entity
@Table(name = "orders")
public class TradeOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`orderID`")
    private UUID orderId;

    @Column(name = "`portfolioID`", nullable = false)
    private UUID portfolioId;

    @Column(name = "ticker", nullable = false)
    private String ticker;

    @Column(name = "quantity", nullable = false)
    private Long quantity;

    @Column(name = "`initTime`", nullable = false)
    private Instant initTime;

    @Column(name = "market", nullable = false)
    private String market;

    @Column(name = "side", nullable = false)
    private boolean side;

    @Column(name = "`initPrice`", nullable = false)
    private Double initPrice;

    protected TradeOrder() {
    }

    public TradeOrder(UUID portfolioId, String ticker, Long quantity, String market, boolean side, Double initPrice) {
        this.portfolioId = portfolioId;
        this.ticker = ticker;
        this.quantity = quantity;
        this.market = market;
        this.side = side;
        this.initPrice = initPrice;
    }

    public UUID getOrderId() {
        return orderId;
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

    public Instant getInitTime() {
        return initTime;
    }

    public String getMarket() {
        return market;
    }

    public boolean isSide() {
        return side;
    }

    public Double getInitPrice() {
        return initPrice;
    }
}
