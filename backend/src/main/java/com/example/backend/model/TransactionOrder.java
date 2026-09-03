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
@Table(name = "transactions")
public class TransactionOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`transactionID`")
    private UUID transactionId;

    @Column(name = "`portfolioID`", nullable = false)
    private UUID portfolioId;

    @Column(name = "amount", nullable = false)
    private Long amount;

    @Column(name = "currency", nullable = false)
    private String currency;

    @Column(name = "`initTime`", nullable = false)
    private Instant initTime;

    @Column(name = "side", nullable = false)
    private String side;

    protected TransactionOrder() {
    }

    public TransactionOrder(UUID portfolioId, Long amount, String currency, String side) {
        this.portfolioId = portfolioId;
        this.amount = amount;
        this.currency = currency;
        this.side = side;
    }

    public UUID getTransactionId() {
        return transactionId;
    }

    public UUID getPortfolioId() {
        return portfolioId;
    }

    public Long getAmount() {
        return amount;
    }

    public Instant getInitTime() {
        return initTime;
    }

    public String getSide() {
        return side;
    }

    public String getCurrency() {
        return currency;
    }

}
