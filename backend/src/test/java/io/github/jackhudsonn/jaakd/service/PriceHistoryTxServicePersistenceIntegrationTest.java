package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.BackendApplication;
import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.InstrumentPrice;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandle;
import io.github.jackhudsonn.jaakd.repository.InstrumentPriceRepository;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(classes = BackendApplication.class)
@ActiveProfiles("test")
@Transactional
class PriceHistoryTxServicePersistenceIntegrationTest {

    private static final LocalDate FROM = LocalDate.of(2026, 10, 1);
    private static final LocalDate TO = LocalDate.of(2026, 10, 31);
    private static final LocalDateTime FETCHED_AT = LocalDateTime.of(2026, 10, 20, 22, 0);

    @Autowired
    private PriceHistoryTxService priceHistoryTxService;

    @Autowired
    private InstrumentRepository instrumentRepository;

    @Autowired
    private InstrumentPriceRepository instrumentPriceRepository;

    @Autowired
    private EntityManager entityManager;

    private UUID instrumentId;

    @BeforeEach
    void setUp() {
        Instrument instrument = instrumentRepository.save(
            new Instrument("PRICETEST", "NASDAQ", "Price Test Inc.", InstrumentClass.EQUITY, CashCurrency.USD)
        );
        instrumentId = instrument.getInstrumentId();
    }

    @Test
    void writeCandles_insertsThenSkipsUnchangedThenUpdatesChanged() {
        List<FauxnanceCandle> firstFetch = List.of(
            new FauxnanceCandle("2026-10-15", 346.95001220703125, 347.85, 341.6, 342.0, 342.0, 39605715.0, false),
            new FauxnanceCandle("2026-10-16", 346.08, 347.82, 340.46, 343.4599914550781, 343.4599914550781, null, true)
        );

        assertEquals(2, write(firstFetch));

        // Same candles again: rounding to the column scale must make them compare equal, so nothing is written.
        assertEquals(0, write(firstFetch));

        // The synthetic day is replaced by real data, and adjclose is restated on the earlier day.
        List<FauxnanceCandle> secondFetch = List.of(
            new FauxnanceCandle("2026-10-15", 346.95001220703125, 347.85, 341.6, 342.0, 171.0, 39605715.0, false),
            new FauxnanceCandle("2026-10-16", 346.08, 347.82, 340.46, 343.4599914550781, 343.4599914550781, 59852690.0, false)
        );

        assertEquals(2, write(secondFetch));

        List<InstrumentPrice> rows = instrumentPriceRepository.findByInstrumentIdAndPriceDateBetween(instrumentId, FROM, TO)
            .stream()
            .sorted(Comparator.comparing(InstrumentPrice::getPriceDate))
            .toList();

        assertEquals(2, rows.size());
        assertEquals(0, rows.get(0).getAdjClose().compareTo(new BigDecimal("171")));
        assertEquals(0, rows.get(0).getClose().compareTo(new BigDecimal("342")));
        assertFalse(rows.get(1).isSynthetic());
        assertEquals(59852690L, rows.get(1).getVolume());
        assertEquals("USD", rows.get(1).getCurrency());
    }

    @Test
    void writeCandles_skipsCandlesOutsideTheWindowOrMissingPrices() {
        List<FauxnanceCandle> candles = List.of(
            new FauxnanceCandle("2026-09-30", 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, false),
            new FauxnanceCandle("2026-10-02", 1.0, 1.0, 1.0, null, 1.0, 1.0, false),
            new FauxnanceCandle("not-a-date", 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, false),
            new FauxnanceCandle("2026-10-05", 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, false)
        );

        assertEquals(1, write(candles));

        List<InstrumentPrice> rows = instrumentPriceRepository.findByInstrumentIdAndPriceDateBetween(instrumentId, FROM, TO);
        assertEquals(1, rows.size());
        assertTrue(rows.get(0).getPriceDate().isEqual(LocalDate.of(2026, 10, 5)));
    }

    // Flush and clear around each write so every call reads rows back from the database, like separate nightly runs.
    private int write(List<FauxnanceCandle> candles) {
        int written = priceHistoryTxService.writeCandles(instrumentId, "USD", candles, FROM, TO, FETCHED_AT);
        entityManager.flush();
        entityManager.clear();
        return written;
    }
}
