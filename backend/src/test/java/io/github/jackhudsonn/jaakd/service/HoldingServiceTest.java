package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.CashConversionRequest;
import io.github.jackhudsonn.jaakd.dto.CashConversionResponse;
import io.github.jackhudsonn.jaakd.dto.LotMatchResponse;
import io.github.jackhudsonn.jaakd.dto.PositionLotResponse;
import io.github.jackhudsonn.jaakd.exception.HoldingNotFoundException;
import io.github.jackhudsonn.jaakd.exception.InvalidTradeException;
import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.Profile;
import io.github.jackhudsonn.jaakd.model.PositionLot;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.LotMatchRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import io.github.jackhudsonn.jaakd.repository.PositionLotRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceQuoteResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HoldingServiceTest {

    @Mock
    private HoldingRepository holdingRepository;

    @Mock
    private PositionLotRepository positionLotRepository;

    @Mock
    private LotMatchRepository lotMatchRepository;

    @Mock
    private InstrumentRepository instrumentRepository;

    @Mock
    private PortfolioRepository portfolioRepository;

    @Mock
    private OrderLogRepository orderLogRepository;

    @Mock
    private FauxnanceService fauxnanceService;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private HoldingService holdingService;

    @Test
    void getPositionLotsForHolding_mapsRowsForOwnedHolding() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID holdingId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID buyLogId = UUID.randomUUID();

        Holding holding = new Holding(portfolioId, instrumentId);
        setField(holding, "holdingID", holdingId);

        PositionLot lot = new PositionLot(
            holdingId,
            buyLogId,
            LocalDateTime.parse("2026-09-25T10:00:00"),
            new BigDecimal("10.00"),
            new BigDecimal("6.00"),
            new BigDecimal("100.25")
        );
        setField(lot, "positionLotID", UUID.randomUUID());

        when(currentUserService.getUserId()).thenReturn(userId);
        when(holdingRepository.findOwnedByHoldingId(holdingId, userId)).thenReturn(Optional.of(holding));
        when(positionLotRepository.findOwnedByHoldingIdOldestFirst(holdingId, userId)).thenReturn(List.of(lot));

        List<PositionLotResponse> result = holdingService.getPositionLotsForHolding(holdingId);

        assertEquals(1, result.size());
        assertEquals(lot.getPositionLotID(), result.get(0).positionLotId());
        assertEquals(new BigDecimal("10.00"), result.get(0).originalQuantity());
        assertEquals(new BigDecimal("6.00"), result.get(0).remainingQuantity());
        assertEquals(new BigDecimal("100.25"), result.get(0).unitCost());
    }

    @Test
    void getLotMatchesForHolding_ownedHoldingNoRows_returnsEmptyList() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID holdingId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();

        Holding holding = new Holding(portfolioId, instrumentId);
        setField(holding, "holdingID", holdingId);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(holdingRepository.findOwnedByHoldingId(holdingId, userId)).thenReturn(Optional.of(holding));
        when(lotMatchRepository.findOwnedByHoldingIdOldestFirst(holdingId, userId)).thenReturn(List.of());

        List<LotMatchResponse> result = holdingService.getLotMatchesForHolding(holdingId);

        assertEquals(0, result.size());
    }

    @Test
    void getLotMatchesForHolding_unownedHolding_throwsNotFoundAndSkipsLotQuery() {
        UUID userId = UUID.randomUUID();
        UUID holdingId = UUID.randomUUID();

        when(currentUserService.getUserId()).thenReturn(userId);
        when(holdingRepository.findOwnedByHoldingId(holdingId, userId)).thenReturn(Optional.empty());

        assertThrows(HoldingNotFoundException.class, () -> holdingService.getLotMatchesForHolding(holdingId));

        verify(lotMatchRepository, never()).findOwnedByHoldingIdOldestFirst(holdingId, userId);
    }

    @Test
    void convertCash_directPairRate_updatesBalancesAndReturnsSummary() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID eurInstrumentId = UUID.randomUUID();
        UUID usdInstrumentId = UUID.randomUUID();

        Portfolio portfolio = new Portfolio(new Profile(UUID.randomUUID(), BigDecimal.ZERO));
        setField(portfolio, "portfolioId", portfolioId);

        Instrument eurCash = new Instrument("EUR", "INTERNAL", "Euro Cash", InstrumentClass.CASH);
        setField(eurCash, "instrumentId", eurInstrumentId);
        Instrument usdCash = new Instrument("USD", "INTERNAL", "US Dollar Cash", InstrumentClass.CASH);
        setField(usdCash, "instrumentId", usdInstrumentId);

        Holding eurHolding = new Holding(UUID.randomUUID(), portfolioId, eurInstrumentId);
        eurHolding.setCurrentQuantity(new BigDecimal("100.000000"));
        Holding usdHolding = new Holding(UUID.randomUUID(), portfolioId, usdInstrumentId);
        usdHolding.setCurrentQuantity(new BigDecimal("5.000000"));

        CashConversionRequest request = new CashConversionRequest(
            CashCurrency.EUR,
            CashCurrency.USD,
            new BigDecimal("10.000000"),
            "rebalance"
        );

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findOwnedByPortfolioId(portfolioId, userId)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findByTickerIgnoreCaseAndInstrumentClass("EUR", InstrumentClass.CASH))
            .thenReturn(Optional.of(eurCash));
        when(instrumentRepository.findByTickerIgnoreCaseAndInstrumentClass("USD", InstrumentClass.CASH))
            .thenReturn(Optional.of(usdCash));
        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, eurInstrumentId))
            .thenReturn(Optional.of(eurHolding));
        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, usdInstrumentId))
            .thenReturn(Optional.of(usdHolding));
        when(fauxnanceService.getQuotes(List.of("EURUSD")))
            .thenReturn(List.of(new FauxnanceQuoteResponse("EURUSD", 1.2, null, null, "USD", null, "open")));
        when(holdingRepository.save(org.mockito.ArgumentMatchers.any(Holding.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        when(orderLogRepository.save(org.mockito.ArgumentMatchers.any(OrderLog.class)))
            .thenAnswer(invocation -> {
                OrderLog log = invocation.getArgument(0);
                setField(log, "logOrderID", UUID.randomUUID());
                return log;
            });

        CashConversionResponse response = holdingService.convertCash(portfolioId, request);

        assertNotNull(response.orderId());
        assertNotNull(response.logOrderId());
        assertEquals(new BigDecimal("10.000000"), response.sourceAmount());
        assertEquals(new BigDecimal("1.2"), response.conversionRate());
        assertEquals(new BigDecimal("12.000000"), response.targetAmount());
        assertEquals(new BigDecimal("90.000000"), response.sourceBalanceAfter());
        assertEquals(new BigDecimal("17.000000"), response.targetBalanceAfter());
        assertEquals("rebalance", response.metadata());
    }

    @Test
    void convertCash_directRateUnavailable_usesInverseRate() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID gbpInstrumentId = UUID.randomUUID();
        UUID eurInstrumentId = UUID.randomUUID();

        Portfolio portfolio = new Portfolio(new Profile(UUID.randomUUID(), BigDecimal.ZERO));
        setField(portfolio, "portfolioId", portfolioId);

        Instrument gbpCash = new Instrument("GBP", "INTERNAL", "Pound Cash", InstrumentClass.CASH);
        setField(gbpCash, "instrumentId", gbpInstrumentId);
        Instrument eurCash = new Instrument("EUR", "INTERNAL", "Euro Cash", InstrumentClass.CASH);
        setField(eurCash, "instrumentId", eurInstrumentId);

        Holding gbpHolding = new Holding(UUID.randomUUID(), portfolioId, gbpInstrumentId);
        gbpHolding.setCurrentQuantity(new BigDecimal("20.000000"));
        Holding eurHolding = new Holding(UUID.randomUUID(), portfolioId, eurInstrumentId);
        eurHolding.setCurrentQuantity(new BigDecimal("1.000000"));

        CashConversionRequest request = new CashConversionRequest(
            CashCurrency.GBP,
            CashCurrency.EUR,
            new BigDecimal("4.000000"),
            null
        );

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findOwnedByPortfolioId(portfolioId, userId)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findByTickerIgnoreCaseAndInstrumentClass("GBP", InstrumentClass.CASH))
            .thenReturn(Optional.of(gbpCash));
        when(instrumentRepository.findByTickerIgnoreCaseAndInstrumentClass("EUR", InstrumentClass.CASH))
            .thenReturn(Optional.of(eurCash));
        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, gbpInstrumentId))
            .thenReturn(Optional.of(gbpHolding));
        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, eurInstrumentId))
            .thenReturn(Optional.of(eurHolding));
        when(fauxnanceService.getQuotes(List.of("GBPEUR")))
            .thenReturn(List.of(new FauxnanceQuoteResponse("GBPEUR", null, null, null, "EUR", null, "open")));
        when(fauxnanceService.getQuotes(List.of("EURGBP")))
            .thenReturn(List.of(new FauxnanceQuoteResponse("EURGBP", 0.8, null, null, "GBP", null, "open")));
        when(holdingRepository.save(org.mockito.ArgumentMatchers.any(Holding.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        when(orderLogRepository.save(org.mockito.ArgumentMatchers.any(OrderLog.class)))
            .thenAnswer(invocation -> {
                OrderLog log = invocation.getArgument(0);
                setField(log, "logOrderID", UUID.randomUUID());
                return log;
            });

        CashConversionResponse response = holdingService.convertCash(portfolioId, request);

        assertNotNull(response);
        assertNotNull(response.orderId());
        assertNotNull(response.logOrderId());
        assertEquals(new BigDecimal("1.2500000000"), response.conversionRate());
        assertEquals(new BigDecimal("5.000000"), response.targetAmount());
        assertEquals(new BigDecimal("16.000000"), response.sourceBalanceAfter());
        assertEquals(new BigDecimal("6.000000"), response.targetBalanceAfter());
    }

    @Test
    void convertCash_insufficientSourceBalance_throws() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID usdInstrumentId = UUID.randomUUID();
        UUID eurInstrumentId = UUID.randomUUID();

        Portfolio portfolio = new Portfolio(new Profile(UUID.randomUUID(), BigDecimal.ZERO));
        setField(portfolio, "portfolioId", portfolioId);

        Instrument usdCash = new Instrument("USD", "INTERNAL", "US Dollar Cash", InstrumentClass.CASH);
        setField(usdCash, "instrumentId", usdInstrumentId);
        Instrument eurCash = new Instrument("EUR", "INTERNAL", "Euro Cash", InstrumentClass.CASH);
        setField(eurCash, "instrumentId", eurInstrumentId);

        Holding usdHolding = new Holding(UUID.randomUUID(), portfolioId, usdInstrumentId);
        usdHolding.setCurrentQuantity(new BigDecimal("1.000000"));

        CashConversionRequest request = new CashConversionRequest(
            CashCurrency.USD,
            CashCurrency.EUR,
            new BigDecimal("2.000000"),
            null
        );

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findOwnedByPortfolioId(portfolioId, userId)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findByTickerIgnoreCaseAndInstrumentClass("USD", InstrumentClass.CASH))
            .thenReturn(Optional.of(usdCash));
        when(instrumentRepository.findByTickerIgnoreCaseAndInstrumentClass("EUR", InstrumentClass.CASH))
            .thenReturn(Optional.of(eurCash));
        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, usdInstrumentId))
            .thenReturn(Optional.of(usdHolding));

        assertThrows(InvalidTradeException.class, () -> holdingService.convertCash(portfolioId, request));
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
