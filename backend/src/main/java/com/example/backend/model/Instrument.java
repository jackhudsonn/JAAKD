package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// Maps to public.instruments — centralized reference data for tickers, replacing raw ticker text on child tables.
@Entity
@Table(name = "instruments")
public class Instrument {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`instrumentID`")
    private UUID instrumentId;

    @Column(name = "last_update", nullable = false)
    private Instant lastUpdate;

    @Column(name = "ticker")
    private String ticker;

    @Column(name = "type", nullable = false)
    private String type;

    @Column(name = "market")
    private String market;

    @Column(name = "price")
    private Double price;

    protected Instrument() {
    }

    public Instrument(String type) {
        this.type = type;
    }

    public UUID getInstrumentId() {
        return instrumentId;
    }

    public Instant getLastUpdate() {
        return lastUpdate;
    }

    public void setLastUpdate(Instant lastUpdate) {
        this.lastUpdate = lastUpdate;
    }

    public String getTicker() {
        return ticker;
    }

    public void setTicker(String ticker) {
        this.ticker = ticker;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getMarket() {
        return market;
    }

    public void setMarket(String market) {
        this.market = market;
    }

    public Double getPrice() {
        return price;
    }

    public void setPrice(Double price) {
        this.price = price;
    }
}
