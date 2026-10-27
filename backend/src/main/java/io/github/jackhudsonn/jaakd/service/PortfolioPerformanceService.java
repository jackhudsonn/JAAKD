package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.InstrumentPrice;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandle;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.repository.InstrumentPriceRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

// Rebuilds a portfolio's daily USD value from its EXECUTED order logs, priced with stored daily closes.
// The caller checks ownership first.
@Service
public class PortfolioPerformanceService {

    private static final Logger log = LoggerFactory.getLogger(PortfolioPerformanceService.class);

    // Closes from a few days before the first buy, so a buy on a weekend still has a close to carry forward.
    private static final int PRICE_LOOKBACK_DAYS = 7;
    private static final int MONEY_SCALE = 2;
    // Per symbol, so one slow Fauxnance answer cannot hold up the whole graph.
    private static final Duration CANDLE_TIMEOUT = Duration.ofSeconds(5);
    private static final long NANOS_PER_MILLI = 1_000_000L;

    private final OrderLogRepository orderLogRepository;
    private final InstrumentPriceRepository instrumentPriceRepository;
    private final FauxnanceService fauxnanceService;
    private final QuoteService quoteService;
    private final Clock clock;

    // Daily closes only change once a day (the nightly PriceHistoryService run), so they are kept until the date
    // changes; reloads and other portfolios holding the same instrument then skip the database and Fauxnance.
    private final ConcurrentHashMap<CloseKey, NavigableMap<LocalDate, BigDecimal>> closesCache = new ConcurrentHashMap<>();
    private final AtomicReference<LocalDate> closesCacheDay = new AtomicReference<>();

    public PortfolioPerformanceService(
        OrderLogRepository orderLogRepository,
        InstrumentPriceRepository instrumentPriceRepository,
        FauxnanceService fauxnanceService,
        QuoteService quoteService,
        Clock clock
    ) {
        this.orderLogRepository = orderLogRepository;
        this.instrumentPriceRepository = instrumentPriceRepository;
        this.fauxnanceService = fauxnanceService;
        this.quoteService = quoteService;
        this.clock = clock;
    }

    public List<DailyValue> getDailyValues(UUID portfolioId) {
        long startedAt = System.nanoTime();
        RequestTimings timings = new RequestTimings();

        List<OrderLog> logs = loadUsdLogs(portfolioId, timings);
        List<DailyValue> values = logs.isEmpty() ? List.of() : replay(logs, timings);

        log.info(
            "Performance for portfolio {}: {} points in {} ms (database {} ms, Fauxnance {} ms, {} of {} instruments from cache)",
            portfolioId,
            values.size(),
            toMillis(System.nanoTime() - startedAt),
            toMillis(timings.databaseNanos),
            toMillis(timings.fauxnanceNanos),
            timings.cachedInstruments,
            timings.pricedInstruments
        );
        return values;
    }

    private List<OrderLog> loadUsdLogs(UUID portfolioId, RequestTimings timings) {
        long startedAt = System.nanoTime();
        List<OrderLog> executed = orderLogRepository.findByPortfolioPortfolioIdAndStatusOrderByTimestampAsc(
            portfolioId,
            OrderStatus.EXECUTED
        );
        timings.databaseNanos += System.nanoTime() - startedAt;

        List<OrderLog> logs = new ArrayList<>();
        for (OrderLog orderLog : executed) {
            if (countsTowardsUsdValue(orderLog)) {
                logs.add(orderLog);
            }
        }
        return logs;
    }

    private List<DailyValue> replay(List<OrderLog> logs, RequestTimings timings) {
        LocalDate today = LocalDate.now(clock);
        LocalDate firstDay = logs.get(0).getTimeStamp().toLocalDate();
        if (firstDay.isAfter(today)) {
            firstDay = today;
        }

        Map<UUID, NavigableMap<LocalDate, BigDecimal>> pricesByInstrument = loadPrices(logs, today, timings);

        BigDecimal cash = BigDecimal.ZERO;
        Map<UUID, BigDecimal> quantityByInstrument = new LinkedHashMap<>();
        List<DailyValue> values = new ArrayList<>();
        int next = 0;

        for (LocalDate day = firstDay; !day.isAfter(today); day = day.plusDays(1)) {
            while (next < logs.size() && !logs.get(next).getTimeStamp().toLocalDate().isAfter(day)) {
                cash = apply(logs.get(next), cash, quantityByInstrument);
                next++;
            }

            if (day.equals(today)) {
                applyLiveQuotes(quantityByInstrument, pricesByInstrument, today, timings);
            }

            values.add(new DailyValue(day, valueOn(day, cash, quantityByInstrument, pricesByInstrument)));
        }

        return values;
    }

    // Only USD moves the USD cash line: USD deposits and withdrawals, and buys and sells of USD-traded instruments.
    private boolean countsTowardsUsdValue(OrderLog orderLog) {
        Instrument instrument = orderLog.getInstrument();
        if (instrument == null || orderLog.getTimeStamp() == null) {
            return false;
        }

        return switch (orderLog.getSide()) {
            case DEPOSIT, WITHDRAW -> instrument.getInstrumentClass() == InstrumentClass.CASH
                && CashCurrency.USD.name().equalsIgnoreCase(instrument.getTicker());
            case BUY, SELL -> instrument.getInstrumentClass() != InstrumentClass.CASH
                && instrument.getTradingCurrency() == CashCurrency.USD;
            case FX -> false;
        };
    }

    private BigDecimal apply(OrderLog orderLog, BigDecimal cash, Map<UUID, BigDecimal> quantityByInstrument) {
        BigDecimal quantity = BigDecimal.valueOf(orderLog.getQuantity());
        BigDecimal notional = quantity.multiply(BigDecimal.valueOf(orderLog.getExecutionPrice()));
        UUID instrumentId = orderLog.getInstrument().getInstrumentId();

        return switch (orderLog.getSide()) {
            case DEPOSIT -> cash.add(quantity);
            case WITHDRAW -> cash.subtract(quantity);
            case BUY -> {
                quantityByInstrument.merge(instrumentId, quantity, BigDecimal::add);
                yield cash.subtract(notional);
            }
            case SELL -> {
                quantityByInstrument.merge(instrumentId, quantity.negate(), BigDecimal::add);
                yield cash.add(notional);
            }
            case FX -> cash;
        };
    }

    // The days each instrument was actually held: from its first buy until it was last sold out, or today.
    private Map<UUID, PriceWindow> heldWindows(List<OrderLog> logs, LocalDate today) {
        Map<UUID, LocalDate> firstHeld = new LinkedHashMap<>();
        Map<UUID, LocalDate> lastHeld = new HashMap<>();
        Map<UUID, BigDecimal> quantityByInstrument = new HashMap<>();

        for (OrderLog orderLog : logs) {
            if (orderLog.getInstrument().getInstrumentClass() == InstrumentClass.CASH) {
                continue;
            }

            UUID instrumentId = orderLog.getInstrument().getInstrumentId();
            LocalDate day = orderLog.getTimeStamp().toLocalDate();
            BigDecimal quantity = BigDecimal.valueOf(orderLog.getQuantity());
            BigDecimal change = orderLog.getSide() == OrderSide.SELL ? quantity.negate() : quantity;

            firstHeld.putIfAbsent(instrumentId, day);
            BigDecimal remaining = quantityByInstrument.merge(instrumentId, change, BigDecimal::add);
            lastHeld.put(instrumentId, remaining.signum() > 0 ? today : day);
        }

        Map<UUID, PriceWindow> windows = new LinkedHashMap<>();
        for (Map.Entry<UUID, LocalDate> entry : firstHeld.entrySet()) {
            LocalDate from = entry.getValue().minusDays(PRICE_LOOKBACK_DAYS);
            LocalDate to = lastHeld.get(entry.getKey());
            windows.put(entry.getKey(), new PriceWindow(from, to.isBefore(from) ? from : to));
        }
        return windows;
    }

    private Map<UUID, NavigableMap<LocalDate, BigDecimal>> loadPrices(
        List<OrderLog> logs,
        LocalDate today,
        RequestTimings timings
    ) {
        Map<UUID, PriceWindow> windows = heldWindows(logs, today);
        Map<UUID, Instrument> instruments = new LinkedHashMap<>();
        for (OrderLog orderLog : logs) {
            Instrument instrument = orderLog.getInstrument();
            if (windows.containsKey(instrument.getInstrumentId())) {
                instruments.putIfAbsent(instrument.getInstrumentId(), instrument);
            }
        }
        timings.pricedInstruments = instruments.size();

        clearCacheOnNewDay(today);
        Map<UUID, NavigableMap<LocalDate, BigDecimal>> pricesByInstrument = new HashMap<>();
        List<Instrument> notCached = new ArrayList<>();
        for (Instrument instrument : instruments.values()) {
            UUID instrumentId = instrument.getInstrumentId();
            NavigableMap<LocalDate, BigDecimal> cached = closesCache.get(cacheKey(instrumentId, windows));
            if (cached == null) {
                pricesByInstrument.put(instrumentId, new TreeMap<>());
                notCached.add(instrument);
            } else {
                pricesByInstrument.put(instrumentId, new TreeMap<>(cached));
                timings.cachedInstruments++;
            }
        }

        if (!notCached.isEmpty()) {
            addStoredCloses(notCached, windows, pricesByInstrument, timings);

            List<Instrument> withoutStoredCloses = new ArrayList<>();
            for (Instrument instrument : notCached) {
                if (pricesByInstrument.get(instrument.getInstrumentId()).isEmpty()) {
                    withoutStoredCloses.add(instrument);
                }
            }
            addCandleCloses(withoutStoredCloses, windows, pricesByInstrument, timings);
            cacheCloses(notCached, windows, pricesByInstrument);
        }

        addFillPrices(logs, pricesByInstrument);
        return pricesByInstrument;
    }

    // Empty results are not cached, so an instrument that failed is tried again on the next request.
    private void cacheCloses(
        List<Instrument> instruments,
        Map<UUID, PriceWindow> windows,
        Map<UUID, NavigableMap<LocalDate, BigDecimal>> pricesByInstrument
    ) {
        for (Instrument instrument : instruments) {
            NavigableMap<LocalDate, BigDecimal> closes = pricesByInstrument.get(instrument.getInstrumentId());
            if (!closes.isEmpty()) {
                closesCache.put(
                    cacheKey(instrument.getInstrumentId(), windows),
                    Collections.unmodifiableNavigableMap(new TreeMap<>(closes))
                );
            }
        }
    }

    // A fill price is a real price on its day; it covers days with no close yet (today, or a failed lookup).
    private void addFillPrices(List<OrderLog> logs, Map<UUID, NavigableMap<LocalDate, BigDecimal>> pricesByInstrument) {
        for (OrderLog orderLog : logs) {
            NavigableMap<LocalDate, BigDecimal> prices = pricesByInstrument.get(orderLog.getInstrument().getInstrumentId());
            if (prices != null && orderLog.getExecutionPrice() > 0) {
                prices.putIfAbsent(orderLog.getTimeStamp().toLocalDate(), BigDecimal.valueOf(orderLog.getExecutionPrice()));
            }
        }
    }

    private void clearCacheOnNewDay(LocalDate today) {
        LocalDate previousDay = closesCacheDay.getAndSet(today);
        if (!today.equals(previousDay)) {
            closesCache.clear();
        }
    }

    private static CloseKey cacheKey(UUID instrumentId, Map<UUID, PriceWindow> windows) {
        PriceWindow window = windows.get(instrumentId);
        return new CloseKey(instrumentId, window.from(), window.to());
    }

    // One query for every instrument, over the widest window, then each instrument keeps only its own days.
    private void addStoredCloses(
        List<Instrument> instruments,
        Map<UUID, PriceWindow> windows,
        Map<UUID, NavigableMap<LocalDate, BigDecimal>> pricesByInstrument,
        RequestTimings timings
    ) {
        List<UUID> instrumentIds = new ArrayList<>();
        LocalDate from = null;
        LocalDate to = null;
        for (Instrument instrument : instruments) {
            PriceWindow window = windows.get(instrument.getInstrumentId());
            instrumentIds.add(instrument.getInstrumentId());
            from = from == null || window.from().isBefore(from) ? window.from() : from;
            to = to == null || window.to().isAfter(to) ? window.to() : to;
        }

        long startedAt = System.nanoTime();
        List<InstrumentPrice> stored;
        try {
            stored = instrumentPriceRepository.findByInstrumentIdInAndPriceDateBetween(instrumentIds, from, to);
        } catch (RuntimeException ex) {
            log.warn("Stored closes unavailable for the performance graph: {}", ex.getMessage());
            return;
        } finally {
            timings.databaseNanos += System.nanoTime() - startedAt;
        }

        for (InstrumentPrice price : stored) {
            PriceWindow window = windows.get(price.getInstrumentId());
            if (window != null && price.getClose() != null && window.contains(price.getPriceDate())) {
                pricesByInstrument.get(price.getInstrumentId()).put(price.getPriceDate(), price.getClose());
            }
        }
    }

    // All symbols are requested at once; each has its own timeout, and a failure only skips that instrument.
    private void addCandleCloses(
        List<Instrument> instruments,
        Map<UUID, PriceWindow> windows,
        Map<UUID, NavigableMap<LocalDate, BigDecimal>> pricesByInstrument,
        RequestTimings timings
    ) {
        if (instruments.isEmpty()) {
            return;
        }

        long startedAt = System.nanoTime();
        Map<Instrument, CompletableFuture<FauxnanceCandleResponse>> requests = new LinkedHashMap<>();
        for (Instrument instrument : instruments) {
            PriceWindow window = windows.get(instrument.getInstrumentId());
            CompletableFuture<FauxnanceCandleResponse> request;
            try {
                request = fauxnanceService
                    .getCandlesAsync(fauxnanceSymbol(instrument), window.from(), window.to())
                    .orTimeout(CANDLE_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            } catch (RuntimeException ex) {
                request = CompletableFuture.failedFuture(ex);
            }
            requests.put(instrument, request);
        }

        for (Map.Entry<Instrument, CompletableFuture<FauxnanceCandleResponse>> entry : requests.entrySet()) {
            Instrument instrument = entry.getKey();
            try {
                addCandleCloses(pricesByInstrument.get(instrument.getInstrumentId()), entry.getValue().join());
            } catch (CompletionException ex) {
                Throwable cause = ex.getCause() == null ? ex : ex.getCause();
                log.warn("Performance candles unavailable for {}: {}", instrument.getTicker(), cause.toString());
            }
        }
        timings.fauxnanceNanos += System.nanoTime() - startedAt;
    }

    private void addCandleCloses(NavigableMap<LocalDate, BigDecimal> closes, FauxnanceCandleResponse response) {
        if (response == null || response.candles() == null) {
            return;
        }

        for (FauxnanceCandle candle : response.candles()) {
            if (candle.date() == null || candle.close() == null) {
                continue;
            }

            try {
                closes.put(LocalDate.parse(candle.date()), BigDecimal.valueOf(candle.close()));
            } catch (DateTimeParseException ex) {
                log.warn("Skipping candle with unreadable date: {}", candle.date());
            }
        }
    }

    // Crypto is stored as "X:BTC-USD"; a bare ticker is mapped to the same Fauxnance symbol.
    private String fauxnanceSymbol(Instrument instrument) {
        String ticker = instrument.getTicker().trim().toUpperCase();
        if (instrument.getInstrumentClass() == InstrumentClass.CRYPTO && !ticker.startsWith("X:")) {
            return "X:" + ticker + "-USD";
        }

        return FauxnanceSymbols.forInstrument(instrument);
    }

    // Today's close is usually not stored yet, so the last point uses live prices when Fauxnance answers.
    private void applyLiveQuotes(
        Map<UUID, BigDecimal> quantityByInstrument,
        Map<UUID, NavigableMap<LocalDate, BigDecimal>> pricesByInstrument,
        LocalDate today,
        RequestTimings timings
    ) {
        List<UUID> heldInstrumentIds = new ArrayList<>();
        for (Map.Entry<UUID, BigDecimal> entry : quantityByInstrument.entrySet()) {
            if (entry.getValue().signum() != 0) {
                heldInstrumentIds.add(entry.getKey());
            }
        }

        if (heldInstrumentIds.isEmpty()) {
            return;
        }

        long startedAt = System.nanoTime();
        List<MarketQuote> quotes;
        try {
            quotes = quoteService.getQuotes(heldInstrumentIds);
        } catch (RuntimeException ex) {
            log.warn("Live quotes unavailable for the performance graph, using last closes: {}", ex.getMessage());
            return;
        } finally {
            timings.fauxnanceNanos += System.nanoTime() - startedAt;
        }

        for (int i = 0; i < heldInstrumentIds.size() && i < quotes.size(); i++) {
            MarketQuote quote = quotes.get(i);
            if (quote != null && quote.price() != null && quote.price() > 0) {
                pricesByInstrument
                    .computeIfAbsent(heldInstrumentIds.get(i), id -> new TreeMap<>())
                    .put(today, BigDecimal.valueOf(quote.price()));
            }
        }
    }

    private BigDecimal valueOn(
        LocalDate day,
        BigDecimal cash,
        Map<UUID, BigDecimal> quantityByInstrument,
        Map<UUID, NavigableMap<LocalDate, BigDecimal>> pricesByInstrument
    ) {
        BigDecimal total = cash;
        for (Map.Entry<UUID, BigDecimal> entry : quantityByInstrument.entrySet()) {
            NavigableMap<LocalDate, BigDecimal> prices = pricesByInstrument.get(entry.getKey());
            Map.Entry<LocalDate, BigDecimal> lastKnown = prices == null ? null : prices.floorEntry(day);
            if (lastKnown != null) {
                total = total.add(entry.getValue().multiply(lastKnown.getValue()));
            }
        }

        return total.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    }

    private static long toMillis(long nanos) {
        return nanos / NANOS_PER_MILLI;
    }

    public record DailyValue(LocalDate date, BigDecimal value) {
    }

    private record PriceWindow(LocalDate from, LocalDate to) {

        boolean contains(LocalDate day) {
            return !day.isBefore(from) && !day.isAfter(to);
        }
    }

    private record CloseKey(UUID instrumentId, LocalDate from, LocalDate to) {
    }

    // Per request only, so plain fields are enough.
    private static final class RequestTimings {
        private long databaseNanos;
        private long fauxnanceNanos;
        private int pricedInstruments;
        private int cachedInstruments;
    }
}
