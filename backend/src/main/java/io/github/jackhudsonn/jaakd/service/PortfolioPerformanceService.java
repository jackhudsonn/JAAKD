package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.InstrumentPrice;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandle;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.InstrumentPriceRepository;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
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
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

// Rebuilds a portfolio's daily USD value from its EXECUTED order logs, priced with stored daily closes.
// Non-USD cash is converted at today's rate for every day. Today's point uses the real cash and holdings.
// The caller checks ownership first.
@Service
public class PortfolioPerformanceService {

    private static final Logger log = LoggerFactory.getLogger(PortfolioPerformanceService.class);

    // Closes from a few days before the first buy, so a buy on a weekend still has a close to carry forward.
    private static final int PRICE_LOOKBACK_DAYS = 7;
    private static final int MONEY_SCALE = 2;
    // Per symbol, so one slow Fauxnance answer cannot hold up the whole graph.
    private static final Duration CANDLE_TIMEOUT = Duration.ofSeconds(5);

    private final OrderLogRepository orderLogRepository;
    private final InstrumentPriceRepository instrumentPriceRepository;
    private final HoldingRepository holdingRepository;
    private final InstrumentRepository instrumentRepository;
    private final FauxnanceService fauxnanceService;
    private final QuoteService quoteService;
    private final HoldingService holdingService;
    private final Clock clock;

    // Daily closes only change once a day (the nightly PriceHistoryService run), so they are kept until the date
    // changes; reloads and other portfolios holding the same instrument then skip the database and Fauxnance.
    private final ConcurrentHashMap<CloseKey, NavigableMap<LocalDate, BigDecimal>> closesCache = new ConcurrentHashMap<>();
    private final AtomicReference<LocalDate> closesCacheDay = new AtomicReference<>();

    public PortfolioPerformanceService(
        OrderLogRepository orderLogRepository,
        InstrumentPriceRepository instrumentPriceRepository,
        HoldingRepository holdingRepository,
        InstrumentRepository instrumentRepository,
        FauxnanceService fauxnanceService,
        QuoteService quoteService,
        HoldingService holdingService,
        Clock clock
    ) {
        this.orderLogRepository = orderLogRepository;
        this.instrumentPriceRepository = instrumentPriceRepository;
        this.holdingRepository = holdingRepository;
        this.instrumentRepository = instrumentRepository;
        this.fauxnanceService = fauxnanceService;
        this.quoteService = quoteService;
        this.holdingService = holdingService;
        this.clock = clock;
    }

    public List<DailyValue> getDailyValues(UUID portfolioId) {
        long startedAt = System.nanoTime();
        RequestTimings timings = new RequestTimings();

        List<OrderLog> executed = orderLogRepository
            .findByPortfolioPortfolioIdAndStatusOrderByTimestampAsc(portfolioId, OrderStatus.EXECUTED);
        timings.databaseNanos += System.nanoTime() - startedAt;
        List<OrderLog> logs = executed.stream().filter(this::countsTowardsValue).toList();
        List<DailyValue> values = logs.isEmpty() ? List.of() : replay(portfolioId, logs, timings);

        log.info(
            "Performance for portfolio {}: {} points in {} ms (database {} ms, Fauxnance {} ms, {} of {} instruments from cache)",
            portfolioId, values.size(), toMillis(System.nanoTime() - startedAt), toMillis(timings.databaseNanos),
            toMillis(timings.fauxnanceNanos), timings.cachedInstruments, timings.pricedInstruments
        );
        return values;
    }

    private List<DailyValue> replay(UUID portfolioId, List<OrderLog> logs, RequestTimings timings) {
        LocalDate today = LocalDate.now(clock);
        LocalDate firstDay = logs.get(0).getTimeStamp().toLocalDate();
        if (firstDay.isAfter(today)) {
            firstDay = today;
        }

        Map<UUID, NavigableMap<LocalDate, BigDecimal>> pricesByInstrument = loadPrices(logs, today, timings);
        RealBalances real = loadRealBalances(portfolioId, timings);
        Set<CashCurrency> currencies = cashCurrencies(logs);
        if (real != null) {
            currencies.addAll(real.cash().keySet());
        }
        Map<CashCurrency, BigDecimal> usdRates = loadUsdRates(currencies, timings);

        Map<CashCurrency, BigDecimal> cashByCurrency = new EnumMap<>(CashCurrency.class);
        Map<UUID, BigDecimal> quantityByInstrument = new LinkedHashMap<>();
        List<DailyValue> values = new ArrayList<>();
        int next = 0;

        for (LocalDate day = firstDay; !day.isAfter(today); day = day.plusDays(1)) {
            while (next < logs.size() && !logs.get(next).getTimeStamp().toLocalDate().isAfter(day)) {
                apply(logs.get(next), cashByCurrency, quantityByInstrument);
                next++;
            }

            if (day.equals(today)) {
                if (real != null) {
                    logReplayCheck(portfolioId, cashByCurrency, real.cash());
                    cashByCurrency = real.cash();
                    quantityByInstrument = real.quantities();
                }
                applyLiveQuotes(quantityByInstrument, pricesByInstrument, today, timings);
            }

            BigDecimal cash = cashInUsd(cashByCurrency, usdRates);
            values.add(new DailyValue(day, valueOn(day, cash, quantityByInstrument, pricesByInstrument)));
        }

        return values;
    }

    // Cash moves in every currency (deposits, withdrawals, FX swaps). Instrument trades count only when traded in USD,
    // because holdings are priced with USD closes; a non-USD buy is left out, so its cash stays counted at cost.
    private boolean countsTowardsValue(OrderLog orderLog) {
        Instrument instrument = orderLog.getInstrument();
        boolean isCash = instrument.getInstrumentClass() == InstrumentClass.CASH;
        return switch (orderLog.getSide()) {
            case DEPOSIT, WITHDRAW, FX -> isCash && currencyOf(instrument) != null;
            case BUY, SELL -> !isCash && instrument.getTradingCurrency() == CashCurrency.USD;
        };
    }

    private void apply(OrderLog orderLog, Map<CashCurrency, BigDecimal> cash, Map<UUID, BigDecimal> quantityByInstrument) {
        BigDecimal quantity = BigDecimal.valueOf(orderLog.getQuantity());
        BigDecimal notional = quantity.multiply(BigDecimal.valueOf(orderLog.getExecutionPrice()));
        UUID instrumentId = orderLog.getInstrument().getInstrumentId();

        switch (orderLog.getSide()) {
            case DEPOSIT -> cash.merge(currencyOf(orderLog.getInstrument()), quantity, BigDecimal::add);
            case WITHDRAW -> cash.merge(currencyOf(orderLog.getInstrument()), quantity.negate(), BigDecimal::add);
            case BUY -> {
                quantityByInstrument.merge(instrumentId, quantity, BigDecimal::add);
                cash.merge(CashCurrency.USD, notional.negate(), BigDecimal::add);
            }
            case SELL -> {
                quantityByInstrument.merge(instrumentId, quantity.negate(), BigDecimal::add);
                cash.merge(CashCurrency.USD, notional, BigDecimal::add);
            }
            case FX -> applySwap(orderLog, quantity, notional, cash);
        }
    }

    // An FX row is logged on the source cash instrument (quantity = source amount, executionPrice = rate);
    // the target side is only in the metadata HoldingService writes. Skipped whole if the target is unreadable.
    private void applySwap(OrderLog orderLog, BigDecimal sourceAmount, BigDecimal converted, Map<CashCurrency, BigDecimal> cash) {
        CashCurrency target = swapTarget(orderLog);
        if (target == null) {
            log.warn("Skipping FX log {} without a readable target currency", orderLog.getLogOrderID());
            return;
        }

        BigDecimal targetAmount = converted;
        String recordedAmount = metadataValue(orderLog.getMetadata(), "targetAmount");
        if (recordedAmount != null) {
            try {
                targetAmount = new BigDecimal(recordedAmount);
            } catch (NumberFormatException ex) {
                log.warn("FX log {} has an unreadable targetAmount, using quantity times rate", orderLog.getLogOrderID());
            }
        }

        cash.merge(currencyOf(orderLog.getInstrument()), sourceAmount.negate(), BigDecimal::add);
        cash.merge(target, targetAmount, BigDecimal::add);
    }

    private static CashCurrency swapTarget(OrderLog orderLog) {
        return CashCurrency.fromCodeOrNull(metadataValue(orderLog.getMetadata(), "targetCurrency"));
    }

    // First match wins: HoldingService writes its own fields before any user note.
    private static String metadataValue(String metadata, String key) {
        if (metadata == null) {
            return null;
        }

        for (String part : metadata.split(";")) {
            if (part.startsWith(key + "=")) {
                return part.substring(key.length() + 1).trim();
            }
        }
        return null;
    }

    private static CashCurrency currencyOf(Instrument cashInstrument) {
        return CashCurrency.fromCodeOrNull(cashInstrument.getTicker());
    }

    private static Set<CashCurrency> cashCurrencies(List<OrderLog> logs) {
        Set<CashCurrency> currencies = EnumSet.noneOf(CashCurrency.class);
        for (OrderLog orderLog : logs) {
            if (orderLog.getInstrument().getInstrumentClass() == InstrumentClass.CASH) {
                currencies.add(currencyOf(orderLog.getInstrument()));
            }
            if (orderLog.getSide() == OrderSide.FX && swapTarget(orderLog) != null) {
                currencies.add(swapTarget(orderLog));
            }
        }
        return currencies;
    }

    // The portfolio's current cash per currency and USD-traded quantities. Null when there are no holdings rows
    // or they cannot be read, so today's point keeps the replay: a portfolio with executed logs always has cash rows.
    private RealBalances loadRealBalances(UUID portfolioId, RequestTimings timings) {
        long startedAt = System.nanoTime();
        try {
            List<Holding> holdings = holdingRepository.findByPortfolioID(portfolioId);
            if (holdings.isEmpty()) {
                return null;
            }

            Map<UUID, Instrument> instruments = new HashMap<>();
            for (Instrument instrument : instrumentRepository.findAllById(holdings.stream().map(Holding::getInstrumentID).toList())) {
                instruments.put(instrument.getInstrumentId(), instrument);
            }

            Map<CashCurrency, BigDecimal> cash = new EnumMap<>(CashCurrency.class);
            Map<UUID, BigDecimal> quantities = new LinkedHashMap<>();
            for (Holding holding : holdings) {
                Instrument instrument = instruments.get(holding.getInstrumentID());
                BigDecimal quantity = holding.getCurrentQuantity();
                if (instrument == null || quantity == null || quantity.signum() == 0) {
                    continue;
                }

                if (instrument.getInstrumentClass() == InstrumentClass.CASH) {
                    CashCurrency currency = currencyOf(instrument);
                    if (currency != null) {
                        cash.put(currency, quantity);
                    }
                } else if (instrument.getTradingCurrency() == CashCurrency.USD) {
                    quantities.put(instrument.getInstrumentId(), quantity);
                }
            }
            return new RealBalances(cash, quantities);
        } catch (RuntimeException ex) {
            log.warn("Current holdings unavailable for the performance graph, today uses the replay: {}", ex.getMessage());
            return null;
        } finally {
            timings.databaseNanos += System.nanoTime() - startedAt;
        }
    }

    // A mismatch means an order log is missing or extra; today's point still shows the real balances.
    private static void logReplayCheck(UUID portfolioId, Map<CashCurrency, BigDecimal> replayed, Map<CashCurrency, BigDecimal> real) {
        Set<CashCurrency> currencies = EnumSet.noneOf(CashCurrency.class);
        currencies.addAll(replayed.keySet());
        currencies.addAll(real.keySet());
        // To the cent: holdings are stored at 6 decimals, the replay multiplies exact quantities and prices.
        boolean matches = currencies.stream().allMatch(currency -> replayed.getOrDefault(currency, BigDecimal.ZERO)
            .setScale(MONEY_SCALE, RoundingMode.HALF_UP)
            .compareTo(real.getOrDefault(currency, BigDecimal.ZERO).setScale(MONEY_SCALE, RoundingMode.HALF_UP)) == 0);

        if (matches) {
            log.info("Performance replay for portfolio {} matches the real cash: {}", portfolioId, real);
        } else {
            log.warn("Performance replay for portfolio {} does not match the real cash: replayed {}, real {}", portfolioId, replayed, real);
        }
    }

    // One lookup per currency per request; a currency whose rate cannot be found is left out of every day.
    private Map<CashCurrency, BigDecimal> loadUsdRates(Set<CashCurrency> currencies, RequestTimings timings) {
        long startedAt = System.nanoTime();
        Map<CashCurrency, BigDecimal> rates = new EnumMap<>(CashCurrency.class);
        rates.put(CashCurrency.USD, BigDecimal.ONE);
        for (CashCurrency currency : currencies) {
            if (currency == CashCurrency.USD) {
                continue;
            }

            try {
                rates.put(currency, holdingService.resolveFxRate(currency, CashCurrency.USD));
            } catch (RuntimeException ex) {
                log.warn("No {} to USD rate for the performance graph, leaving {} cash out: {}", currency, currency, ex.getMessage());
            }
        }
        timings.fauxnanceNanos += System.nanoTime() - startedAt;
        return rates;
    }

    private static BigDecimal cashInUsd(Map<CashCurrency, BigDecimal> cashByCurrency, Map<CashCurrency, BigDecimal> usdRates) {
        BigDecimal total = BigDecimal.ZERO;
        for (Map.Entry<CashCurrency, BigDecimal> entry : cashByCurrency.entrySet()) {
            BigDecimal rate = usdRates.get(entry.getKey());
            if (rate != null) {
                total = total.add(entry.getValue().multiply(rate));
            }
        }
        return total;
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
        firstHeld.forEach((id, first) -> windows.put(id, new PriceWindow(first.minusDays(PRICE_LOOKBACK_DAYS), lastHeld.get(id))));
        return windows;
    }

    private Map<UUID, NavigableMap<LocalDate, BigDecimal>> loadPrices(List<OrderLog> logs, LocalDate today, RequestTimings timings) {
        Map<UUID, PriceWindow> windows = heldWindows(logs, today);
        Map<UUID, Instrument> instruments = new LinkedHashMap<>();
        for (OrderLog orderLog : logs) {
            if (windows.containsKey(orderLog.getInstrument().getInstrumentId())) {
                instruments.putIfAbsent(orderLog.getInstrument().getInstrumentId(), orderLog.getInstrument());
            }
        }
        timings.pricedInstruments = instruments.size();

        clearCacheOnNewDay(today);
        Map<UUID, NavigableMap<LocalDate, BigDecimal>> pricesByInstrument = new HashMap<>();
        List<Instrument> notCached = new ArrayList<>();
        for (Instrument instrument : instruments.values()) {
            NavigableMap<LocalDate, BigDecimal> cached = closesCache.get(cacheKey(instrument.getInstrumentId(), windows));
            pricesByInstrument.put(instrument.getInstrumentId(), cached == null ? new TreeMap<>() : new TreeMap<>(cached));
            if (cached == null) {
                notCached.add(instrument);
            } else {
                timings.cachedInstruments++;
            }
        }

        if (!notCached.isEmpty()) {
            addStoredCloses(notCached, windows, pricesByInstrument, timings);
            List<Instrument> withoutStoredCloses = notCached.stream()
                .filter(instrument -> pricesByInstrument.get(instrument.getInstrumentId()).isEmpty())
                .toList();
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
                closesCache.put(cacheKey(instrument.getInstrumentId(), windows), Collections.unmodifiableNavigableMap(new TreeMap<>(closes)));
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
        if (!today.equals(closesCacheDay.getAndSet(today))) {
            closesCache.clear();
        }
    }

    private static CloseKey cacheKey(UUID instrumentId, Map<UUID, PriceWindow> windows) {
        return new CloseKey(instrumentId, windows.get(instrumentId));
    }

    // One query for every instrument, over the widest window, then each instrument keeps only its own days.
    private void addStoredCloses(
        List<Instrument> instruments,
        Map<UUID, PriceWindow> windows,
        Map<UUID, NavigableMap<LocalDate, BigDecimal>> pricesByInstrument,
        RequestTimings timings
    ) {
        List<UUID> instrumentIds = instruments.stream().map(Instrument::getInstrumentId).toList();
        LocalDate from = instrumentIds.stream().map(id -> windows.get(id).from()).min(LocalDate::compareTo).orElseThrow();
        LocalDate to = instrumentIds.stream().map(id -> windows.get(id).to()).max(LocalDate::compareTo).orElseThrow();

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
            if (windows.get(price.getInstrumentId()).contains(price.getPriceDate())) {
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

        requests.forEach((instrument, request) -> {
            try {
                addCandleCloses(pricesByInstrument.get(instrument.getInstrumentId()), request.join());
            } catch (CompletionException ex) {
                Throwable cause = ex.getCause() == null ? ex : ex.getCause();
                log.warn("Performance candles unavailable for {}: {}", instrument.getTicker(), cause.toString());
            }
        });
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
        List<UUID> heldInstrumentIds = quantityByInstrument.entrySet().stream()
            .filter(entry -> entry.getValue().signum() != 0)
            .map(Map.Entry::getKey)
            .toList();
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
        return TimeUnit.NANOSECONDS.toMillis(nanos);
    }

    public record DailyValue(LocalDate date, BigDecimal value) {
    }

    private record PriceWindow(LocalDate from, LocalDate to) {

        boolean contains(LocalDate day) {
            return !day.isBefore(from) && !day.isAfter(to);
        }
    }

    private record RealBalances(Map<CashCurrency, BigDecimal> cash, Map<UUID, BigDecimal> quantities) {
    }

    private record CloseKey(UUID instrumentId, PriceWindow window) {
    }

    private static final class RequestTimings {
        private long databaseNanos;
        private long fauxnanceNanos;
        private int pricedInstruments;
        private int cachedInstruments;
    }
}
