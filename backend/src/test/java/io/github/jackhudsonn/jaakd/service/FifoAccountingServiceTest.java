package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.InvalidTradeException;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.LotMatch;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.PositionLot;
import io.github.jackhudsonn.jaakd.model.Profile;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.LotMatchRepository;
import io.github.jackhudsonn.jaakd.repository.PositionLotRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FifoAccountingServiceTest {

    @Mock
    private HoldingRepository holdingRepository;

    @Mock
    private PositionLotRepository positionLotRepository;

    @Mock
    private LotMatchRepository lotMatchRepository;

    @InjectMocks
    private FifoAccountingService fifoAccountingService;

    @Test
    void applyExecution_buyCreatesPositionLotAndUpdatesHolding() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID buyLogId = UUID.randomUUID();

        Holding holding = new Holding(UUID.randomUUID(), portfolioId, instrumentId);
        OrderLog buyLog = buildExecutedOrderLog(buyLogId, portfolioId, instrumentId, OrderSide.BUY, 100, 110);

        when(positionLotRepository.existsBySourceBuyLogOrderID(buyLogId)).thenReturn(false);
        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, instrumentId)).thenReturn(Optional.of(holding));

        fifoAccountingService.applyExecution(buyLog);

        ArgumentCaptor<PositionLot> lotCaptor = ArgumentCaptor.forClass(PositionLot.class);
        verify(positionLotRepository, times(1)).save(lotCaptor.capture());

        PositionLot savedLot = lotCaptor.getValue();
        assertEquals(new BigDecimal("100.0"), savedLot.getOriginalQuantity());
        assertEquals(new BigDecimal("100.0"), savedLot.getRemainingQuantity());
        assertEquals(new BigDecimal("110.0"), savedLot.getUnitCost());

        ArgumentCaptor<Holding> holdingCaptor = ArgumentCaptor.forClass(Holding.class);
        verify(holdingRepository, times(1)).save(holdingCaptor.capture());
        assertEquals(new BigDecimal("100.0"), holdingCaptor.getValue().getCurrentQuantity());
    }

    @Test
    void applyExecution_sellCrossesLotsAndCreatesTwoMatches() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID sellLogId = UUID.randomUUID();
        UUID holdingId = UUID.randomUUID();

        Holding holding = new Holding(holdingId, portfolioId, instrumentId);
        holding.setCurrentQuantity(new BigDecimal("180.0"));
        holding.setCumulativeRealizedPnl(BigDecimal.ZERO);

        PositionLot firstLot = new PositionLot(
            holdingId,
            UUID.randomUUID(),
            ZonedDateTime.now().minusDays(2),
            new BigDecimal("100.0"),
            new BigDecimal("100.0"),
            new BigDecimal("110.0")
        );
        setField(firstLot, "positionLotID", UUID.randomUUID());

        PositionLot secondLot = new PositionLot(
            holdingId,
            UUID.randomUUID(),
            ZonedDateTime.now().minusDays(1),
            new BigDecimal("80.0"),
            new BigDecimal("80.0"),
            new BigDecimal("115.0")
        );
        setField(secondLot, "positionLotID", UUID.randomUUID());

        OrderLog sellLog = buildExecutedOrderLog(sellLogId, portfolioId, instrumentId, OrderSide.SELL, 130, 120);

        when(lotMatchRepository.existsBySellLogOrderID(sellLogId)).thenReturn(false);
        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, instrumentId)).thenReturn(Optional.of(holding));
        when(positionLotRepository.findByHoldingIDAndRemainingQuantityGreaterThanOrderByOpenedAtAscPositionLotIDAsc(
            holdingId,
            BigDecimal.ZERO
        )).thenReturn(List.of(firstLot, secondLot));

        fifoAccountingService.applyExecution(sellLog);

        ArgumentCaptor<LotMatch> matchCaptor = ArgumentCaptor.forClass(LotMatch.class);
        verify(lotMatchRepository, times(2)).save(matchCaptor.capture());
        List<LotMatch> matches = matchCaptor.getAllValues();

        BigDecimal totalMatchedQty = matches.stream()
            .map(LotMatch::getMatchedQuantity)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(new BigDecimal("130.0"), totalMatchedQty);

        BigDecimal totalRealized = matches.stream()
            .map(LotMatch::getRealizedPnlAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(new BigDecimal("1150.00"), totalRealized.setScale(2));

        assertEquals(new BigDecimal("1000.00"), matches.get(0).getRealizedPnlAmount().setScale(2));
        assertEquals(new BigDecimal("150.00"), matches.get(1).getRealizedPnlAmount().setScale(2));

        ArgumentCaptor<PositionLot> lotCaptor = ArgumentCaptor.forClass(PositionLot.class);
        verify(positionLotRepository, times(2)).save(lotCaptor.capture());
        List<PositionLot> updatedLots = lotCaptor.getAllValues();
        assertEquals(new BigDecimal("0.0"), updatedLots.get(0).getRemainingQuantity());
        assertEquals(new BigDecimal("50.0"), updatedLots.get(1).getRemainingQuantity());
        assertTrue(updatedLots.get(0).getRemainingQuantity().compareTo(BigDecimal.ZERO) >= 0);
        assertTrue(updatedLots.get(1).getRemainingQuantity().compareTo(BigDecimal.ZERO) >= 0);
        assertTrue(updatedLots.get(0).getRemainingQuantity().compareTo(updatedLots.get(0).getOriginalQuantity()) <= 0);
        assertTrue(updatedLots.get(1).getRemainingQuantity().compareTo(updatedLots.get(1).getOriginalQuantity()) <= 0);

        BigDecimal openLotRemainder = updatedLots.stream()
            .map(PositionLot::getRemainingQuantity)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        ArgumentCaptor<Holding> holdingCaptor = ArgumentCaptor.forClass(Holding.class);
        verify(holdingRepository, times(1)).save(holdingCaptor.capture());
        Holding updatedHolding = holdingCaptor.getValue();
        assertEquals(new BigDecimal("50.0"), updatedHolding.getCurrentQuantity());
        assertEquals(new BigDecimal("1150.00"), updatedHolding.getCumulativeRealizedPnl().setScale(2));
        assertEquals(openLotRemainder, updatedHolding.getCurrentQuantity());
    }

    @Test
    void applyExecution_oversellThrowsValidationError() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID sellLogId = UUID.randomUUID();

        Holding holding = new Holding(UUID.randomUUID(), portfolioId, instrumentId);
        holding.setCurrentQuantity(new BigDecimal("50.0"));

        OrderLog sellLog = buildExecutedOrderLog(sellLogId, portfolioId, instrumentId, OrderSide.SELL, 60, 120);

        when(lotMatchRepository.existsBySellLogOrderID(sellLogId)).thenReturn(false);
        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, instrumentId)).thenReturn(Optional.of(holding));

        assertThrows(InvalidTradeException.class, () -> fifoAccountingService.applyExecution(sellLog));

        verify(positionLotRepository, never())
            .findByHoldingIDAndRemainingQuantityGreaterThanOrderByOpenedAtAscPositionLotIDAsc(holding.getHoldingID(), BigDecimal.ZERO);
        verify(holdingRepository, never()).save(holding);
    }

    @Test
    void applyExecution_nonExecutedOrderIsNoOp() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();

        OrderLog orderLog = buildExecutedOrderLog(logOrderId, portfolioId, instrumentId, OrderSide.BUY, 10, 100);
        orderLog.setStatus(OrderStatus.SUBMITTED);

        fifoAccountingService.applyExecution(orderLog);

        verify(holdingRepository, never()).findByPortfolioIDAndInstrumentID(portfolioId, instrumentId);
        verify(positionLotRepository, never()).existsBySourceBuyLogOrderID(logOrderId);
        verify(lotMatchRepository, never()).existsBySellLogOrderID(logOrderId);
    }

    @Test
    void applyExecution_depositIncreasesHoldingQuantityWithoutLotWrites() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID holdingId = UUID.randomUUID();

        Holding holding = new Holding(holdingId, portfolioId, instrumentId);
        holding.setCurrentQuantity(new BigDecimal("200.0"));

        OrderLog orderLog = buildExecutedOrderLog(logOrderId, portfolioId, instrumentId, OrderSide.DEPOSIT, 1000, 1);

        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, instrumentId)).thenReturn(Optional.of(holding));

        fifoAccountingService.applyExecution(orderLog);

        verify(positionLotRepository, never()).save(any(PositionLot.class));
        verify(lotMatchRepository, never()).save(any(LotMatch.class));

        ArgumentCaptor<Holding> holdingCaptor = ArgumentCaptor.forClass(Holding.class);
        verify(holdingRepository, times(1)).save(holdingCaptor.capture());
        assertEquals(new BigDecimal("1200.0"), holdingCaptor.getValue().getCurrentQuantity());
    }

    @Test
    void applyExecution_depositCreatesMissingHoldingAndSetsQuantity() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();

        OrderLog orderLog = buildExecutedOrderLog(logOrderId, portfolioId, instrumentId, OrderSide.DEPOSIT, 1000, 1);

        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, instrumentId)).thenReturn(Optional.empty());
        when(holdingRepository.save(any(Holding.class))).thenAnswer(invocation -> invocation.getArgument(0));

        fifoAccountingService.applyExecution(orderLog);

        verify(positionLotRepository, never()).save(any(PositionLot.class));
        verify(lotMatchRepository, never()).save(any(LotMatch.class));

        ArgumentCaptor<Holding> holdingCaptor = ArgumentCaptor.forClass(Holding.class);
        verify(holdingRepository, times(2)).save(holdingCaptor.capture());
        Holding finalSavedHolding = holdingCaptor.getAllValues().get(1);

        assertEquals(portfolioId, finalSavedHolding.getPortfolioID());
        assertEquals(instrumentId, finalSavedHolding.getInstrumentID());
        assertEquals(new BigDecimal("1000.0"), finalSavedHolding.getCurrentQuantity());
    }

    @Test
    void applyExecution_withdrawDecreasesHoldingQuantityWithoutLotWrites() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID holdingId = UUID.randomUUID();

        Holding holding = new Holding(holdingId, portfolioId, instrumentId);
        holding.setCurrentQuantity(new BigDecimal("450.0"));

        OrderLog orderLog = buildExecutedOrderLog(logOrderId, portfolioId, instrumentId, OrderSide.WITHDRAW, 100, 1);

        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, instrumentId)).thenReturn(Optional.of(holding));

        fifoAccountingService.applyExecution(orderLog);

        verify(positionLotRepository, never()).save(any(PositionLot.class));
        verify(lotMatchRepository, never()).save(any(LotMatch.class));

        ArgumentCaptor<Holding> holdingCaptor = ArgumentCaptor.forClass(Holding.class);
        verify(holdingRepository, times(1)).save(holdingCaptor.capture());
        assertEquals(new BigDecimal("350.0"), holdingCaptor.getValue().getCurrentQuantity());
    }

    @Test
    void applyExecution_withdrawMoreThanBalanceThrowsValidationError() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID holdingId = UUID.randomUUID();

        Holding holding = new Holding(holdingId, portfolioId, instrumentId);
        holding.setCurrentQuantity(new BigDecimal("75.0"));

        OrderLog orderLog = buildExecutedOrderLog(logOrderId, portfolioId, instrumentId, OrderSide.WITHDRAW, 100, 1);

        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, instrumentId)).thenReturn(Optional.of(holding));

        assertThrows(InvalidTradeException.class, () -> fifoAccountingService.applyExecution(orderLog));

        verify(positionLotRepository, never()).save(any(PositionLot.class));
        verify(lotMatchRepository, never()).save(any(LotMatch.class));
        verify(holdingRepository, never()).save(any(Holding.class));
    }

    @Test
    void applyExecution_buyIdempotencySkipsWhenLotAlreadyExists() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID buyLogId = UUID.randomUUID();

        OrderLog buyLog = buildExecutedOrderLog(buyLogId, portfolioId, instrumentId, OrderSide.BUY, 25, 111);

        when(positionLotRepository.existsBySourceBuyLogOrderID(buyLogId)).thenReturn(true);

        fifoAccountingService.applyExecution(buyLog);

        verify(positionLotRepository, times(1)).existsBySourceBuyLogOrderID(buyLogId);
        verify(holdingRepository, never()).findByPortfolioIDAndInstrumentID(portfolioId, instrumentId);
        verify(positionLotRepository, never()).save(any(PositionLot.class));
        verify(holdingRepository, never()).save(any(Holding.class));
    }

    @Test
    void applyExecution_sellIdempotencySkipsWhenMatchesAlreadyExist() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID sellLogId = UUID.randomUUID();

        OrderLog sellLog = buildExecutedOrderLog(sellLogId, portfolioId, instrumentId, OrderSide.SELL, 10, 120);

        when(lotMatchRepository.existsBySellLogOrderID(sellLogId)).thenReturn(true);

        fifoAccountingService.applyExecution(sellLog);

        verify(lotMatchRepository, times(1)).existsBySellLogOrderID(sellLogId);
        verify(holdingRepository, never()).findByPortfolioIDAndInstrumentID(portfolioId, instrumentId);
        verify(positionLotRepository, never())
            .findByHoldingIDAndRemainingQuantityGreaterThanOrderByOpenedAtAscPositionLotIDAsc(any(UUID.class), any(BigDecimal.class));
        verify(positionLotRepository, never()).save(any(PositionLot.class));
        verify(lotMatchRepository, never()).save(any(LotMatch.class));
        verify(holdingRepository, never()).save(any(Holding.class));
    }

    private OrderLog buildExecutedOrderLog(
        UUID logOrderId,
        UUID portfolioId,
        UUID instrumentId,
        OrderSide side,
        double quantity,
        double executionPrice
    ) throws Exception {
        Profile profile = new Profile("user@example.com", BigDecimal.ZERO);
        Portfolio portfolio = new Portfolio(profile);
        setField(portfolio, "portfolioId", portfolioId);

        Instrument instrument = new Instrument("AAPL", "NASDAQ", "Apple", InstrumentClass.EQUITY);
        setField(instrument, "instrumentId", instrumentId);

        OrderLog orderLog = new OrderLog(UUID.randomUUID(), portfolio, instrument, side, quantity);
        orderLog.setStatus(OrderStatus.EXECUTED);
        orderLog.setExecutionPrice(executionPrice);
        setField(orderLog, "logOrderID", logOrderId);

        return orderLog;
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
