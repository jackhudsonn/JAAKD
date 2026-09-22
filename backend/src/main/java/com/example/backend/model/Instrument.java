package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.util.List;
import java.util.UUID;

// Maps to public.instruments — centralized reference data for tickers, replacing raw ticker text on child tables.
@Entity
@Table(name = "instruments")
public class Instrument {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`instrumentID`")
    private UUID instrumentId;

    @Column(name = "ticker", nullable = false)
    private String ticker;

    @Column(name = "market", nullable = false)
    private String market;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "instrumentClass", nullable = false)
    @Enumerated(EnumType.STRING)
    private InstrumentClass instrumentClass;

    @OneToMany(mappedBy = "instrument")
    private List<Holding> holdings;

    @OneToMany(mappedBy = "instrument")
    private List<OrderLog> orderLogs;

    @OneToMany(mappedBy = "instrument")
    private List<WatchlistItem> watchlistItems;

    protected Instrument() {
    }

    public Instrument(String ticker, String market, String name, InstrumentClass instrumentClass) {
        this.ticker = ticker;
        this.market = market;
        this.name = name;
        this.instrumentClass = instrumentClass;
    }


    public UUID getInstrumentId() {
        return instrumentId;
    }

    public String getTicker() {
        return ticker;
    }

    public String getMarket() {
        return market;
    }

    public String getName() {
        return name;
    }

    public InstrumentClass getInstrumentClass() {
        return instrumentClass;
    }

    public List<Holding> getHoldings() {
        return holdings;
    }

    public List<OrderLog> getOrderLogs() {
        return orderLogs;
    }

    public List<WatchlistItem> getWatchlistItems() {
        return watchlistItems;
    }



}
