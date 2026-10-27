package io.github.jackhudsonn.jaakd.model;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

// Composite key for InstrumentPrice: one row per instrument per trading day.
public class InstrumentPriceId implements Serializable {

    private UUID instrumentId;
    private LocalDate priceDate;

    protected InstrumentPriceId() {
    }

    public InstrumentPriceId(UUID instrumentId, LocalDate priceDate) {
        this.instrumentId = instrumentId;
        this.priceDate = priceDate;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof InstrumentPriceId that)) {
            return false;
        }
        return Objects.equals(instrumentId, that.instrumentId) && Objects.equals(priceDate, that.priceDate);
    }

    @Override
    public int hashCode() {
        return Objects.hash(instrumentId, priceDate);
    }
}
