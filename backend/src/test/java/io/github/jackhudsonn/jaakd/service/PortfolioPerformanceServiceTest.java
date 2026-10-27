package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.FauxnanceClientException;
import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.InstrumentPrice;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.Profile;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandle;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.InstrumentPriceRepository;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeoutException;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PortfolioPerformanceServiceTest {

    // Tuesday 20 Oct 2026; the 17th and 18th are a weekend.
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-20T12:00:00Z"), ZoneOffset.UTC);
    private static final LocalDate FRIDAY = LocalDate.of(2026, 10, 16);
    private static final LocalDate MONDAY = LocalDate.of(2026, 10, 19);
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 20);
    private static final UUID PORTFOLIO_ID = UUID.randomUUID();
    private static final Portfolio PORTFOLIO = portfolio();
    private static final Instrument USD = instrument("USD", InstrumentClass.CASH, CashCurrency.USD);
    private static final Instrument APPLE = instrument("AAPL", InstrumentClass.EQUITY, CashCurrency.USD);
    private static final Instrument EURO = instrument("EUR", InstrumentClass.CASH, CashCurrency.EUR);

    @Mock private OrderLogRepository orderLogRepository;
    @Mock private InstrumentPriceRepository instrumentPriceRepository;
    @Mock private HoldingRepository holdingRepository;
    @Mock private InstrumentRepository instrumentRepository;
    @Mock private FauxnanceService fauxnanceService;
    @Mock private QuoteService quoteService;
    @Mock private HoldingService holdingService;

    static Stream<Arguments> valuations() {
        return Stream.of(
            Arguments.of("deposit only, non-USD instruments ignored", List.of(
                log(USD, OrderSide.DEPOSIT, 1000, 0, MONDAY),
                log(instrument("TCS.NS", InstrumentClass.EQUITY, CashCurrency.INR), OrderSide.BUY, 1, 3000, TODAY)
            ), List.of(), null, List.of("1000.00", "1000.00")),
            // 5 shares at the 110 close, then at the live 130 rather than the stored 120.
            Arguments.of("buy then price change", List.of(
                log(USD, OrderSide.DEPOSIT, 1000, 0, MONDAY), log(APPLE, OrderSide.BUY, 5, 100, MONDAY)
            ), List.of(close(MONDAY, "110"), close(TODAY, "120")), 130.0, List.of("1050.00", "1150.00")),
            // Today: cash 740 plus 3 shares at the 120 close.
            Arguments.of("sell", List.of(
                log(USD, OrderSide.DEPOSIT, 1000, 0, MONDAY), log(APPLE, OrderSide.BUY, 5, 100, MONDAY),
                log(APPLE, OrderSide.SELL, 2, 120, TODAY)
            ), List.of(close(MONDAY, "100"), close(TODAY, "120")), null, List.of("1000.00", "1100.00")),
            Arguments.of("gap carry forward over the weekend", List.of(
                log(USD, OrderSide.DEPOSIT, 1000, 0, FRIDAY), log(APPLE, OrderSide.BUY, 5, 100, FRIDAY)
            ), List.of(close(FRIDAY, "100"), close(MONDAY, "104")), null,
                List.of("1000.00", "1000.00", "1000.00", "1020.00", "1020.00"))
        );
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("valuations")
    void valuesEachDay(String name, List<OrderLog> logs, List<InstrumentPrice> closes, Double liveQuote, List<String> expected) {
        givenLogs(logs.toArray(OrderLog[]::new));
        lenient().when(instrumentPriceRepository.findByInstrumentIdInAndPriceDateBetween(anyCollection(), any(), any()))
            .thenReturn(closes);
        lenient().when(quoteService.getQuotes(anyList())).thenReturn(liveQuote == null
            ? List.of() : List.of(new MarketQuote("AAPL", liveQuote, liveQuote, liveQuote, "USD", null, "open")));

        List<PortfolioPerformanceService.DailyValue> values = service(CLOCK).getDailyValues(PORTFOLIO_ID);

        assertEquals(expected, amounts(values));
        assertEquals(logs.get(0).getTimeStamp().toLocalDate(), values.get(0).date());
        assertEquals(TODAY, values.get(values.size() - 1).date());
    }

    @Test
    void convertsNonUsdCashAtTodaysRateAndSkipsACurrencyWithoutOne() {
        givenLogs(log(instrument("EUR", InstrumentClass.CASH, CashCurrency.EUR), OrderSide.DEPOSIT, 100, 0, MONDAY),
            log(instrument("GBP", InstrumentClass.CASH, CashCurrency.GBP), OrderSide.DEPOSIT, 50, 0, MONDAY));
        when(holdingService.resolveFxRate(CashCurrency.EUR, CashCurrency.USD)).thenReturn(new BigDecimal("1.10"));
        when(holdingService.resolveFxRate(CashCurrency.GBP, CashCurrency.USD)).thenThrow(new FauxnanceClientException("no rate"));

        assertEquals(List.of("110.00", "110.00"), amounts(service(CLOCK).getDailyValues(PORTFOLIO_ID)));
    }

    @Test
    void aUsdToEurSwapKeepsTheTotalAboutTheSame() {
        OrderLog swap = log(USD, OrderSide.FX, 500, 0.9, MONDAY);
        // The note repeats a key on purpose: HoldingService's own fields come first and win.
        swap.setMetadata("fxConversion=true;sourceCurrency=USD;targetCurrency=EUR;sourceAmount=500;conversionRate=0.9;"
            + "targetAmount=450.000000;note=targetCurrency=GBP");
        givenLogs(log(USD, OrderSide.DEPOSIT, 1000, 0, FRIDAY), swap);
        when(holdingService.resolveFxRate(CashCurrency.EUR, CashCurrency.USD)).thenReturn(new BigDecimal("1.1111111111"));

        // 500 USD plus 450 EUR back at today's rate.
        assertEquals(List.of("1000.00", "1000.00", "1000.00", "1000.00", "1000.00"),
            amounts(service(CLOCK).getDailyValues(PORTFOLIO_ID)));
    }

    @Test
    void replayEndsOnTheRealBalances() {
        OrderLog swap = log(USD, OrderSide.FX, 100, 0.9, MONDAY);
        swap.setMetadata("fxConversion=true;sourceCurrency=USD;targetCurrency=EUR;sourceAmount=100;targetAmount=90.000000");
        givenLogs(log(USD, OrderSide.DEPOSIT, 1000, 0, FRIDAY), log(APPLE, OrderSide.BUY, 5, 100, FRIDAY), swap);
        givenRealBalances(holding(USD, "400"), holding(EURO, "90"), holding(APPLE, "5"));
        when(instrumentPriceRepository.findByInstrumentIdInAndPriceDateBetween(anyCollection(), any(), any()))
            .thenReturn(List.of(close(FRIDAY, "100")));
        when(holdingService.resolveFxRate(CashCurrency.EUR, CashCurrency.USD)).thenReturn(new BigDecimal("1.1111111111"));
        when(quoteService.getQuotes(anyList())).thenReturn(List.of());

        // Monday is the replay, today is the real balances: equal only if the replay ends where the account is.
        assertEquals(List.of("1000.00", "1000.00", "1000.00", "1000.00", "1000.00"),
            amounts(service(CLOCK).getDailyValues(PORTFOLIO_ID)));
    }

    @Test
    void todayUsesTheRealBalancesWhenTheReplayDisagrees() {
        givenLogs(log(USD, OrderSide.DEPOSIT, 1000, 0, MONDAY));
        givenRealBalances(holding(USD, "900"));

        assertEquals(List.of("1000.00", "900.00"), amounts(service(CLOCK).getDailyValues(PORTFOLIO_ID)));
    }

    @Test
    void emptyHistoryHasNoPoints() {
        givenLogs();
        assertEquals(List.of(), service(CLOCK).getDailyValues(PORTFOLIO_ID));
    }

    @Test
    void fallsBackToFauxnanceCandlesAndSkipsASymbolThatTimesOut() {
        Instrument bitcoin = instrument("BTC", InstrumentClass.CRYPTO, CashCurrency.USD);
        givenLogs(log(USD, OrderSide.DEPOSIT, 1000, 0, MONDAY), log(APPLE, OrderSide.BUY, 1, 100, MONDAY),
            log(bitcoin, OrderSide.BUY, 1, 500, MONDAY));
        when(instrumentPriceRepository.findByInstrumentIdInAndPriceDateBetween(anyCollection(), any(), any())).thenReturn(List.of());
        when(fauxnanceService.getCandlesAsync(eq("AAPL"), any(), any())).thenReturn(CompletableFuture.failedFuture(new TimeoutException()));
        when(fauxnanceService.getCandlesAsync(eq("X:BTC-USD"), any(), any())).thenReturn(CompletableFuture.completedFuture(
            new FauxnanceCandleResponse("X:BTC-USD", "USD", List.of(candle("2026-10-19", 550.0), candle("2026-10-20", 600.0)))));
        when(quoteService.getQuotes(anyList())).thenReturn(List.of());

        // Cash 400; Apple stays at its 100 fill price, Bitcoin follows its candles.
        assertEquals(List.of(new BigDecimal("1050.00"), new BigDecimal("1100.00")),
            service(CLOCK).getDailyValues(PORTFOLIO_ID).stream().map(PortfolioPerformanceService.DailyValue::value).toList());
    }

    @Test
    void loadsClosesInOneQueryOnlyForTheDaysInstrumentsWereHeld() {
        Instrument microsoft = instrument("MSFT", InstrumentClass.EQUITY, CashCurrency.USD);
        givenLogs(log(USD, OrderSide.DEPOSIT, 1000, 0, FRIDAY), log(APPLE, OrderSide.BUY, 1, 100, FRIDAY),
            log(microsoft, OrderSide.BUY, 1, 200, FRIDAY), log(APPLE, OrderSide.SELL, 1, 100, MONDAY),
            log(microsoft, OrderSide.SELL, 1, 200, MONDAY));
        when(instrumentPriceRepository.findByInstrumentIdInAndPriceDateBetween(anyCollection(), any(), any()))
            .thenReturn(List.of(close(FRIDAY, "100")));

        service(CLOCK).getDailyValues(PORTFOLIO_ID);

        verify(instrumentPriceRepository).findByInstrumentIdInAndPriceDateBetween(
            List.of(APPLE.getInstrumentId(), microsoft.getInstrumentId()), FRIDAY.minusDays(7), MONDAY);
        verifyNoInteractions(quoteService);
    }

    @Test
    void cachesClosesForTheDayAndReloadsOnTheNextDay() {
        Clock clock = mock(Clock.class);
        when(clock.getZone()).thenReturn(ZoneOffset.UTC);
        when(clock.instant()).thenReturn(
            Instant.parse("2026-10-20T09:00:00Z"), Instant.parse("2026-10-20T10:00:00Z"), Instant.parse("2026-10-21T09:00:00Z"));
        PortfolioPerformanceService service = service(clock);
        // Sold out on Monday, so the price window (the cache key) is the same on both days.
        givenLogs(log(USD, OrderSide.DEPOSIT, 1000, 0, FRIDAY), log(APPLE, OrderSide.BUY, 5, 100, FRIDAY),
            log(APPLE, OrderSide.SELL, 5, 110, MONDAY));
        when(instrumentPriceRepository.findByInstrumentIdInAndPriceDateBetween(anyCollection(), any(), any()))
            .thenReturn(List.of(close(FRIDAY, "100")));

        for (int i = 0; i < 3; i++) {
            service.getDailyValues(PORTFOLIO_ID);
        }

        verify(instrumentPriceRepository, times(2)).findByInstrumentIdInAndPriceDateBetween(anyCollection(), any(), any());
    }

    private PortfolioPerformanceService service(Clock clock) {
        return new PortfolioPerformanceService(
            orderLogRepository, instrumentPriceRepository, holdingRepository, instrumentRepository, fauxnanceService, quoteService,
            holdingService, clock);
    }

    private void givenRealBalances(Holding... holdings) {
        when(holdingRepository.findByPortfolioID(PORTFOLIO_ID)).thenReturn(List.of(holdings));
        when(instrumentRepository.findAllById(any())).thenReturn(List.of(USD, EURO, APPLE));
    }

    private static List<String> amounts(List<PortfolioPerformanceService.DailyValue> values) {
        return values.stream().map(value -> value.value().toPlainString()).toList();
    }

    private void givenLogs(OrderLog... logs) {
        when(orderLogRepository.findByPortfolioPortfolioIdAndStatusOrderByTimestampAsc(PORTFOLIO_ID, OrderStatus.EXECUTED))
            .thenReturn(List.of(logs));
    }

    private static OrderLog log(Instrument instrument, OrderSide side, double quantity, double price, LocalDate day) {
        OrderLog orderLog = new OrderLog(UUID.randomUUID(), PORTFOLIO, instrument, side, quantity);
        orderLog.setStatus(OrderStatus.EXECUTED);
        orderLog.setExecutionPrice(price);
        orderLog.setTimeStamp(day.atTime(LocalTime.NOON));
        return orderLog;
    }

    private static Holding holding(Instrument instrument, String quantity) {
        Holding holding = new Holding(PORTFOLIO_ID, instrument.getInstrumentId());
        holding.setCurrentQuantity(new BigDecimal(quantity));
        return holding;
    }

    private static Portfolio portfolio() {
        Portfolio portfolio = new Portfolio(new Profile(BigDecimal.ZERO));
        ReflectionTestUtils.setField(portfolio, "portfolioId", PORTFOLIO_ID);
        return portfolio;
    }

    private static Instrument instrument(String ticker, InstrumentClass instrumentClass, CashCurrency currency) {
        Instrument instrument = new Instrument(ticker, "TEST", ticker, instrumentClass, currency);
        ReflectionTestUtils.setField(instrument, "instrumentId", UUID.randomUUID());
        return instrument;
    }

    private static InstrumentPrice close(LocalDate day, String close) {
        InstrumentPrice price = new InstrumentPrice(APPLE.getInstrumentId(), day);
        BigDecimal value = new BigDecimal(close);
        price.apply(value, value, value, value, value, 0L, "USD", false, day.atStartOfDay());
        return price;
    }

    private static FauxnanceCandle candle(String date, double close) {
        return new FauxnanceCandle(date, close, close, close, close, close, 0.0, false);
    }
}
