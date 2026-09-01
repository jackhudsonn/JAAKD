package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// Maps to public.log — the order execution/status trail (named OrderLog to avoid clashing with logging frameworks).
@Entity
@Table(name = "log")
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
    private String status = "Placed";

    @Column(name = "`executePrice`")
    private Double executePrice;

    protected OrderLog() {
    }

    public OrderLog(UUID orderId) {
        this.orderId = orderId;
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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Double getExecutePrice() {
        return executePrice;
    }

    public void setExecutePrice(Double executePrice) {
        this.executePrice = executePrice;
    }
}
