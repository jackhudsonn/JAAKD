package com.example.backend.model;

import java.util.List;

public class Holding {
    
    List<Trade> trades;
    Instrument instrument;

    public Holding(List<Trade> trades) {
        this.trades = trades;
       // this.instrument = trades.getFirst().getOrderLogID().getInstrumentID();
    }

    public void addTrade() {

    }

    public void removeTrade() {

    }

    
}
