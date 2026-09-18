package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// Maps to public.logs — the order execution/status trail (named OrderLog to avoid clashing with logging frameworks).
@Entity
@Table(name = "logs")
public class OrderLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`logID`")
    private UUID logId;

    @Column(name = "`orderID`", nullable = false)
    private UUID orderId;

    @Column(name = "`logTime`", nullable = false)
    private Instant logTime;

    @Column(name = "status", nullable = false)
    private Status status;

    @Column(name = "`price`")
    private Double price;

    protected OrderLog() {
    }

    public OrderLog(UUID orderId, Instant logTime, Status status) {
        this.orderId = orderId;
        this.logTime = logTime;
        this.status = status;
    }

    public UUID getLogId() {
        return logId;
    }

    public UUID getOrderId() {
        return orderId;
    }

    public Instant getLogTime() {
        return logTime;
    }

    public Status getStatus() {
        return status;
    }

    public double getPrice() {
        return price;
    }

    public void setPrice(Double price) {
        this.price = price;
    }
}
