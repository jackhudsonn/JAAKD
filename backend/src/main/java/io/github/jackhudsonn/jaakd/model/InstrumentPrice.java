package io.github.jackhudsonn.jaakd.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import org.springframework.data.domain.Persistable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.UUID;

// Maps to public."instrumentPrices" — one daily Fauxnance candle per instrument, refreshed by PriceHistoryService.
// Persistable so saving a new row inserts directly instead of merging (which would SELECT first on an assigned key).
@Entity
@Table(name = "instrumentPrices")
@IdClass(InstrumentPriceId.class)
public class InstrumentPrice implements Persistable<InstrumentPriceId> {

    @Id
    @Column(name = "`instrumentID`")
    private UUID instrumentId;

    @Id
    @Column(name = "priceDate")
    private LocalDate priceDate;

    @Column(name = "open", nullable = false, precision = 24, scale = 10)
    private BigDecimal open;

    @Column(name = "high", nullable = false, precision = 24, scale = 10)
    private BigDecimal high;

    @Column(name = "low", nullable = false, precision = 24, scale = 10)
    private BigDecimal low;

    @Column(name = "close", nullable = false, precision = 24, scale = 10)
    private BigDecimal close;

    @Column(name = "adjClose", nullable = false, precision = 24, scale = 10)
    private BigDecimal adjClose;

    @Column(name = "volume")
    private Long volume;

    @Column(name = "currency", nullable = false)
    private String currency;

    @Column(name = "synthetic", nullable = false)
    private boolean synthetic;

    @Column(name = "fetchedAt", nullable = false)
    private LocalDateTime fetchedAt;

    @Transient
    private boolean isNew = true;

    protected InstrumentPrice() {
    }

    public InstrumentPrice(UUID instrumentId, LocalDate priceDate) {
        this.instrumentId = instrumentId;
        this.priceDate = priceDate;
    }

    // Copies a candle's values onto this row; returns false when nothing changed so callers can skip the write.
    public boolean apply(
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        BigDecimal close,
        BigDecimal adjClose,
        Long volume,
        String currency,
        boolean synthetic,
        LocalDateTime fetchedAt
    ) {
        boolean changed = isNew
            || !sameValue(this.open, open)
            || !sameValue(this.high, high)
            || !sameValue(this.low, low)
            || !sameValue(this.close, close)
            || !sameValue(this.adjClose, adjClose)
            || !Objects.equals(this.volume, volume)
            || !Objects.equals(this.currency, currency)
            || this.synthetic != synthetic;

        if (!changed) {
            return false;
        }

        this.open = open;
        this.high = high;
        this.low = low;
        this.close = close;
        this.adjClose = adjClose;
        this.volume = volume;
        this.currency = currency;
        this.synthetic = synthetic;
        this.fetchedAt = fetchedAt;
        return true;
    }

    private static boolean sameValue(BigDecimal current, BigDecimal incoming) {
        if (current == null || incoming == null) {
            return current == incoming;
        }
        return current.compareTo(incoming) == 0;
    }

    @Override
    public InstrumentPriceId getId() {
        return new InstrumentPriceId(instrumentId, priceDate);
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        this.isNew = false;
    }

    public UUID getInstrumentId() {
        return instrumentId;
    }

    public LocalDate getPriceDate() {
        return priceDate;
    }

    public BigDecimal getOpen() {
        return open;
    }

    public BigDecimal getHigh() {
        return high;
    }

    public BigDecimal getLow() {
        return low;
    }

    public BigDecimal getClose() {
        return close;
    }

    public BigDecimal getAdjClose() {
        return adjClose;
    }

    public Long getVolume() {
        return volume;
    }

    public String getCurrency() {
        return currency;
    }

    public boolean isSynthetic() {
        return synthetic;
    }

    public LocalDateTime getFetchedAt() {
        return fetchedAt;
    }
}
