package com.example.backend.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "holdings")
public class Holding {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`holdingID`")
    private UUID holdingId;

    @ManyToOne
    @JoinColumn(name = "`portfolioID`", nullable = false)
    private Portfolio portfolio;

    @ManyToOne
    @JoinColumn(name = "`instrumentID`", nullable = false)
    private Instrument instrument;

    @Column(name = "`currentQuantity`", nullable = false)
    private double currentQuantity;

    @OneToMany(mappedBy = "holding", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Trade> trades;

    protected Holding() {
    }

    public Holding(Portfolio portfolio, Instrument instrument, double currentQuantity) {
        this.portfolio = portfolio;
        this.instrument = instrument;
        this.currentQuantity = currentQuantity;
    }

    public UUID getHoldingId() {
        return holdingId;
    }

    public Portfolio getPortfolio() {
        return portfolio;
    }

    public Instrument getInstrument() {
        return instrument;
    }

    public double getCurrentQuantity() {
        return currentQuantity;
    }

    public void setCurrentQuantity(double currentQuantity) {
        this.currentQuantity = currentQuantity;
    }

    public List<Trade> getTrades() {
        return trades;
    }

    public void addTrade(Trade trade) {
        if (trades != null) {
            trades.add(trade);
        }
    }

    public void removeTrade(Trade trade) {
        if (trades != null) {
            trades.remove(trade);
        }
    }
}
