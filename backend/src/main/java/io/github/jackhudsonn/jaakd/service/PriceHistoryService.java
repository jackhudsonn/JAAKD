package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.config.PriceHistoryProperties;
import io.github.jackhudsonn.jaakd.exception.ConflictException;
import io.github.jackhudsonn.jaakd.exception.FauxnanceClientException;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.UserType;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandle;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.security.RequiresUserType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.dao.DataAccessException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

// Keeps "instrumentPrices" filled with daily Fauxnance candles: nightly after the US close, or on demand by an admin.
// The analytics pipeline copies this table, so it is the platform's price history.
@Service
public class PriceHistoryService {

    private static final Logger log = LoggerFactory.getLogger(PriceHistoryService.class);

    private final InstrumentRepository instrumentRepository;
    private final FauxnanceService fauxnanceService;
    private final PriceHistoryTxService priceHistoryTxService;
    private final PriceHistoryProperties properties;
    private final Clock clock;
    private final TaskExecutor taskExecutor;

    // Only one refresh at a time, whether started by the schedule or by an admin.
    private final AtomicBoolean running = new AtomicBoolean(false);

    public PriceHistoryService(
        InstrumentRepository instrumentRepository,
        FauxnanceService fauxnanceService,
        PriceHistoryTxService priceHistoryTxService,
        PriceHistoryProperties properties,
        Clock clock,
        @Qualifier("applicationTaskExecutor") TaskExecutor taskExecutor
    ) {
        this.instrumentRepository = instrumentRepository;
        this.fauxnanceService = fauxnanceService;
        this.priceHistoryTxService = priceHistoryTxService;
        this.properties = properties;
        this.clock = clock;
        this.taskExecutor = taskExecutor;
    }

    // 22:00 UTC is after the US close and before the analytics copy at 22:30.
    @Scheduled(cron = "${prices.history.cron:0 0 22 * * *}", zone = "UTC")
    public void scheduledRefresh() {
        if (!running.compareAndSet(false, true)) {
            log.warn("Skipping scheduled price history refresh: a refresh is already running");
            return;
        }

        try {
            refresh();
        } finally {
            running.set(false);
        }
    }

    // Starts a refresh in the background and returns straight away; 409 if one is already running.
    @RequiresUserType(UserType.ADMIN)
    public void startRefresh() {
        if (!running.compareAndSet(false, true)) {
            throw new ConflictException("A price history refresh is already running");
        }

        try {
            taskExecutor.execute(() -> {
                try {
                    refresh();
                } finally {
                    running.set(false);
                }
            });
        } catch (RuntimeException ex) {
            running.set(false);
            throw ex;
        }
    }

    PriceRefreshResult refresh() {
        LocalDate to = LocalDate.now(clock);
        LocalDate from = to.minus(properties.getLookback());
        LocalDateTime fetchedAt = LocalDateTime.now(clock);

        List<Instrument> instruments = instrumentRepository.findAll().stream()
            .filter(instrument -> instrument.getInstrumentClass() != InstrumentClass.CASH)
            .toList();

        int succeeded = 0;
        int failed = 0;
        int rowsWritten = 0;

        for (int i = 0; i < instruments.size(); i++) {
            if (i > 0 && !pauseBetweenRequests()) {
                log.warn("Price history refresh interrupted after {} of {} instruments", i, instruments.size());
                break;
            }

            Instrument instrument = instruments.get(i);
            try {
                rowsWritten += refreshInstrument(instrument, from, to, fetchedAt);
                succeeded++;
            } catch (FauxnanceClientException | DataAccessException ex) {
                failed++;
                log.warn("Price history refresh failed for {}: {}", instrument.getTicker(), ex.getMessage());
            }
        }

        log.info(
            "Price history refresh {} to {}: {} instruments ok, {} failed, {} rows written",
            from, to, succeeded, failed, rowsWritten
        );
        return new PriceRefreshResult(succeeded, failed, rowsWritten);
    }

    private int refreshInstrument(Instrument instrument, LocalDate from, LocalDate to, LocalDateTime fetchedAt) {
        // Fetched outside any transaction so the HTTP call never holds a database connection.
        FauxnanceCandleResponse response = fauxnanceService.getCandles(
            FauxnanceSymbols.forInstrument(instrument),
            from,
            to
        );

        List<FauxnanceCandle> candles = response == null || response.candles() == null
            ? List.of()
            : response.candles();

        String currency = response == null || response.currency() == null || response.currency().isBlank()
            ? instrument.getTradingCurrency().name()
            : response.currency().trim().toUpperCase();

        return priceHistoryTxService.writeCandles(instrument.getInstrumentId(), currency, candles, from, to, fetchedAt);
    }

    private boolean pauseBetweenRequests() {
        try {
            Thread.sleep(properties.getRequestDelay());
            return true;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    record PriceRefreshResult(int instrumentsSucceeded, int instrumentsFailed, int rowsWritten) {
    }
}
