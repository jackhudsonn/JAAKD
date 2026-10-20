package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.model.InstrumentPrice;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandle;
import io.github.jackhudsonn.jaakd.repository.InstrumentPriceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// Writes one instrument's candles in its own short transaction, so the Fauxnance HTTP call
// in PriceHistoryService never holds a database connection.
@Service
public class PriceHistoryTxService {

    private static final Logger log = LoggerFactory.getLogger(PriceHistoryTxService.class);

    // Matches NUMERIC(24,10) on "instrumentPrices"; rounding first keeps unchanged candles from looking changed.
    private static final int PRICE_SCALE = 10;

    private final InstrumentPriceRepository instrumentPriceRepository;

    public PriceHistoryTxService(InstrumentPriceRepository instrumentPriceRepository) {
        this.instrumentPriceRepository = instrumentPriceRepository;
    }

    // Inserts new days and updates changed ones (synthetic days replaced by real data, adjclose restated);
    // returns the number of rows written.
    @Transactional
    public int writeCandles(
        UUID instrumentId,
        String currency,
        List<FauxnanceCandle> candles,
        LocalDate from,
        LocalDate to,
        LocalDateTime fetchedAt
    ) {
        Map<LocalDate, InstrumentPrice> existingByDate = instrumentPriceRepository
            .findByInstrumentIdAndPriceDateBetween(instrumentId, from, to)
            .stream()
            .collect(Collectors.toMap(InstrumentPrice::getPriceDate, Function.identity()));

        List<InstrumentPrice> newRows = new ArrayList<>();
        int written = 0;

        for (FauxnanceCandle candle : candles) {
            LocalDate priceDate = parseDate(candle);
            if (priceDate == null || priceDate.isBefore(from) || priceDate.isAfter(to) || !hasPrices(candle)) {
                log.warn("Skipping unusable candle for instrument {}: {}", instrumentId, candle);
                continue;
            }

            InstrumentPrice row = existingByDate.get(priceDate);
            boolean isNewRow = row == null;
            if (isNewRow) {
                row = new InstrumentPrice(instrumentId, priceDate);
            }

            boolean changed = row.apply(
                price(candle.open()),
                price(candle.high()),
                price(candle.low()),
                price(candle.close()),
                price(candle.adjclose()),
                candle.volume() == null ? null : candle.volume().longValue(),
                currency,
                Boolean.TRUE.equals(candle.synthetic()),
                fetchedAt
            );

            if (changed) {
                written++;
                if (isNewRow) {
                    newRows.add(row);
                }
            }
        }

        // Existing rows are managed, so their changes flush on commit; only new rows need saving.
        instrumentPriceRepository.saveAll(newRows);
        return written;
    }

    private static LocalDate parseDate(FauxnanceCandle candle) {
        if (candle.date() == null) {
            return null;
        }
        try {
            return LocalDate.parse(candle.date());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private static boolean hasPrices(FauxnanceCandle candle) {
        return candle.open() != null
            && candle.high() != null
            && candle.low() != null
            && candle.close() != null
            && candle.adjclose() != null;
    }

    private static BigDecimal price(Double value) {
        return BigDecimal.valueOf(value).setScale(PRICE_SCALE, RoundingMode.HALF_UP);
    }
}
