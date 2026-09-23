package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "trades")
public class Trade {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`tradeID`")
    private UUID tradeID;

    @ManyToOne
    @JoinColumn(name = "`holdingID`", nullable = false)
    private Holding holding;

    @OneToOne
    @JoinColumn(name = "orderLogID", nullable = false)
    private OrderLog orderLog;

    protected Trade() {
    }

    public Trade(Holding holding, OrderLog orderLog) {
        this.holding = holding;
        this.orderLog = orderLog;
    }

    public UUID getTradeID() {
        return tradeID;
    }

    public Holding getHolding() {
        return holding;
    }

    public OrderLog getOrderLog() {
        return orderLog;
    }
}
