package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.config.KafkaTopics;
import io.github.jackhudsonn.jaakd.event.OrderAcceptedEvent;
import io.github.jackhudsonn.jaakd.event.OrderRejectedEvent;
import io.github.jackhudsonn.jaakd.event.OrderSubmittedEvent;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.LotMatchRepository;
import io.github.jackhudsonn.jaakd.repository.PositionLotRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ValidationServiceTest {

    @Mock
    private OrderLogService orderLogService;

    @Mock
    private HoldingRepository holdingRepository;

    @Mock
    private InstrumentRepository instrumentRepository;

    @Mock
    private PositionLotRepository positionLotRepository;

    @Mock
    private LotMatchRepository lotMatchRepository;

    @Mock
    private KafkaTemplate<String, OrderAcceptedEvent> orderAcceptedKafkaTemplate;

    @Mock
    private KafkaTemplate<String, OrderRejectedEvent> orderRejectedKafkaTemplate;

    private ValidationService validationService;

    @BeforeEach
    void setUp() {
        validationService = new ValidationService(
            orderLogService,
            holdingRepository,
            instrumentRepository,
            positionLotRepository,
            lotMatchRepository,
            orderAcceptedKafkaTemplate,
            orderRejectedKafkaTemplate
        );
    }

    @Test
    void handleOrderSubmitted_nullEvent_noop() {
        validationService.handleOrderSubmitted(null);

        verify(orderLogService, never()).appendPendingFromSystem(
            ArgumentMatchers.any(UUID.class),
            ArgumentMatchers.any(UUID.class)
        );
        verify(orderAcceptedKafkaTemplate, never()).send(
            ArgumentMatchers.anyString(),
            ArgumentMatchers.anyString(),
            ArgumentMatchers.any(OrderAcceptedEvent.class)
        );
        verify(orderRejectedKafkaTemplate, never()).send(
            ArgumentMatchers.anyString(),
            ArgumentMatchers.anyString(),
            ArgumentMatchers.any(OrderRejectedEvent.class)
        );
    }

    @Test
    void handleOrderSubmitted_latestCancelledAfterPending_noOutcomeAppendOrEvent() throws Exception {
        UUID orderId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        OrderSubmittedEvent event = new OrderSubmittedEvent(
            orderId,
            logOrderId,
            UUID.randomUUID(),
            UUID.randomUUID(),
            OrderSide.BUY,
            1.0,
            LocalDateTime.now(),
            1L
        );

        when(orderLogService.appendPendingFromSystem(orderId, logOrderId))
            .thenReturn(buildOrderLog(orderId, logOrderId, OrderStatus.CANCELLED));

        validationService.handleOrderSubmitted(event);

        verify(orderLogService, times(1)).appendPendingFromSystem(orderId, logOrderId);
        verify(orderLogService, never()).appendAcceptedFromSystem(
            ArgumentMatchers.any(UUID.class),
            ArgumentMatchers.any(UUID.class)
        );
        verify(orderLogService, never()).appendRejectedFromSystem(
            ArgumentMatchers.any(UUID.class),
            ArgumentMatchers.any(UUID.class),
            ArgumentMatchers.anyString()
        );
        verify(orderAcceptedKafkaTemplate, never()).send(
            ArgumentMatchers.anyString(),
            ArgumentMatchers.anyString(),
            ArgumentMatchers.any(OrderAcceptedEvent.class)
        );
        verify(orderRejectedKafkaTemplate, never()).send(
            ArgumentMatchers.anyString(),
            ArgumentMatchers.anyString(),
            ArgumentMatchers.any(OrderRejectedEvent.class)
        );
    }

    @Test
    void handleOrderSubmitted_nonPositiveQuantity_rejectsAndPublishesRejected() throws Exception {
        UUID orderId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        OrderSubmittedEvent event = new OrderSubmittedEvent(
            orderId,
            logOrderId,
            UUID.randomUUID(),
            UUID.randomUUID(),
            OrderSide.BUY,
            0.0,
            LocalDateTime.now(),
            2L
        );

        when(orderLogService.appendPendingFromSystem(orderId, logOrderId))
            .thenReturn(buildOrderLog(orderId, logOrderId, OrderStatus.PENDING));
        when(orderLogService.appendRejectedFromSystem(orderId, logOrderId, "Quantity must be greater than zero"))
            .thenReturn(buildOrderLog(orderId, logOrderId, OrderStatus.REJECTED));

        validationService.handleOrderSubmitted(event);

        verify(orderLogService, times(1)).appendPendingFromSystem(orderId, logOrderId);
        verify(orderLogService, times(1)).appendRejectedFromSystem(
            orderId,
            logOrderId,
            "Quantity must be greater than zero"
        );
        verify(orderRejectedKafkaTemplate, times(1)).send(
            ArgumentMatchers.eq(KafkaTopics.ORDER_REJECTED),
            ArgumentMatchers.eq(orderId.toString()),
            ArgumentMatchers.any(OrderRejectedEvent.class)
        );
        verify(orderAcceptedKafkaTemplate, never()).send(
            ArgumentMatchers.anyString(),
            ArgumentMatchers.anyString(),
            ArgumentMatchers.any(OrderAcceptedEvent.class)
        );
    }

    @Test
    void handleOrderSubmitted_sellDuplicateMatched_rejects() throws Exception {
        UUID orderId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        OrderSubmittedEvent event = new OrderSubmittedEvent(
            orderId,
            logOrderId,
            UUID.randomUUID(),
            UUID.randomUUID(),
            OrderSide.SELL,
            2.0,
            LocalDateTime.now(),
            3L
        );

        when(orderLogService.appendPendingFromSystem(orderId, logOrderId))
            .thenReturn(buildOrderLog(orderId, logOrderId, OrderStatus.PENDING));
        when(lotMatchRepository.existsBySellLogOrderID(logOrderId)).thenReturn(true);
        when(orderLogService.appendRejectedFromSystem(orderId, logOrderId, "Sell order has already been lot-matched"))
            .thenReturn(buildOrderLog(orderId, logOrderId, OrderStatus.REJECTED));

        validationService.handleOrderSubmitted(event);

        verify(lotMatchRepository, times(1)).existsBySellLogOrderID(logOrderId);
        verify(orderLogService, times(1)).appendRejectedFromSystem(
            orderId,
            logOrderId,
            "Sell order has already been lot-matched"
        );
        verify(orderRejectedKafkaTemplate, times(1)).send(
            ArgumentMatchers.eq(KafkaTopics.ORDER_REJECTED),
            ArgumentMatchers.eq(orderId.toString()),
            ArgumentMatchers.any(OrderRejectedEvent.class)
        );
    }

    @Test
    void handleOrderSubmitted_sellInsufficientOpenLots_rejects() throws Exception {
        UUID orderId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID holdingId = UUID.randomUUID();

        OrderSubmittedEvent event = new OrderSubmittedEvent(
            orderId,
            logOrderId,
            portfolioId,
            instrumentId,
            OrderSide.SELL,
            6.0,
            LocalDateTime.now(),
            4L
        );

        Holding holding = new Holding(holdingId, portfolioId, instrumentId);
        holding.setCurrentQuantity(new BigDecimal("10"));

        when(orderLogService.appendPendingFromSystem(orderId, logOrderId))
            .thenReturn(buildOrderLog(orderId, logOrderId, OrderStatus.PENDING));
        when(lotMatchRepository.existsBySellLogOrderID(logOrderId)).thenReturn(false);
        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, instrumentId)).thenReturn(Optional.of(holding));
        when(positionLotRepository.sumOpenRemainingQuantityByHoldingID(holdingId)).thenReturn(new BigDecimal("5"));
        when(orderLogService.appendRejectedFromSystem(orderId, logOrderId, "Cannot sell more than open lot quantity"))
            .thenReturn(buildOrderLog(orderId, logOrderId, OrderStatus.REJECTED));

        validationService.handleOrderSubmitted(event);

        verify(orderLogService, times(1)).appendRejectedFromSystem(
            orderId,
            logOrderId,
            "Cannot sell more than open lot quantity"
        );
        verify(orderRejectedKafkaTemplate, times(1)).send(
            ArgumentMatchers.eq(KafkaTopics.ORDER_REJECTED),
            ArgumentMatchers.eq(orderId.toString()),
            ArgumentMatchers.any(OrderRejectedEvent.class)
        );
        verify(orderAcceptedKafkaTemplate, never()).send(
            ArgumentMatchers.anyString(),
            ArgumentMatchers.anyString(),
            ArgumentMatchers.any(OrderAcceptedEvent.class)
        );
    }

    @Test
    void handleOrderSubmitted_sellValid_acceptsAndPublishesAccepted() throws Exception {
        UUID orderId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID holdingId = UUID.randomUUID();

        OrderSubmittedEvent event = new OrderSubmittedEvent(
            orderId,
            logOrderId,
            portfolioId,
            instrumentId,
            OrderSide.SELL,
            4.0,
            LocalDateTime.now(),
            5L
        );

        Holding holding = new Holding(holdingId, portfolioId, instrumentId);
        holding.setCurrentQuantity(new BigDecimal("10"));

        when(orderLogService.appendPendingFromSystem(orderId, logOrderId))
            .thenReturn(buildOrderLog(orderId, logOrderId, OrderStatus.PENDING));
        when(lotMatchRepository.existsBySellLogOrderID(logOrderId)).thenReturn(false);
        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, instrumentId)).thenReturn(Optional.of(holding));
        when(positionLotRepository.sumOpenRemainingQuantityByHoldingID(holdingId)).thenReturn(new BigDecimal("10"));
        when(orderLogService.appendAcceptedFromSystem(orderId, logOrderId))
            .thenReturn(buildOrderLog(orderId, logOrderId, OrderStatus.ACCEPTED));

        validationService.handleOrderSubmitted(event);

        verify(orderLogService, times(1)).appendAcceptedFromSystem(orderId, logOrderId);
        verify(orderAcceptedKafkaTemplate, times(1)).send(
            ArgumentMatchers.eq(KafkaTopics.ORDER_ACCEPTED),
            ArgumentMatchers.eq(orderId.toString()),
            ArgumentMatchers.any(OrderAcceptedEvent.class)
        );
        verify(orderRejectedKafkaTemplate, never()).send(
            ArgumentMatchers.anyString(),
            ArgumentMatchers.anyString(),
            ArgumentMatchers.any(OrderRejectedEvent.class)
        );
    }

    @Test
    void handleOrderSubmitted_buyInsufficientCash_rejects() throws Exception {
        UUID orderId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID cashInstrumentId = UUID.randomUUID();

        OrderSubmittedEvent event = new OrderSubmittedEvent(
            orderId,
            logOrderId,
            portfolioId,
            instrumentId,
            OrderSide.BUY,
            5.0,
            LocalDateTime.now(),
            6L
        );

        OrderLog pending = buildOrderLog(orderId, logOrderId, OrderStatus.PENDING);
        pending.setQuotedPrice(10.0);

        Instrument cashInstrument = new Instrument("USD_CASH", "USD", "US Dollar Cash Balance", InstrumentClass.USD);
        setField(cashInstrument, "instrumentId", cashInstrumentId);

        Holding cashHolding = new Holding(UUID.randomUUID(), portfolioId, cashInstrumentId);
        cashHolding.setCurrentQuantity(new BigDecimal("40"));

        when(orderLogService.appendPendingFromSystem(orderId, logOrderId)).thenReturn(pending);
        when(instrumentRepository.findByTickerIgnoreCase("USD_CASH")).thenReturn(Optional.of(cashInstrument));
        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, cashInstrumentId))
            .thenReturn(Optional.of(cashHolding));
        when(orderLogService.appendRejectedFromSystem(orderId, logOrderId, "Cannot buy more than current cash quantity"))
            .thenReturn(buildOrderLog(orderId, logOrderId, OrderStatus.REJECTED));

        validationService.handleOrderSubmitted(event);

        verify(orderLogService, times(1)).appendRejectedFromSystem(
            orderId,
            logOrderId,
            "Cannot buy more than current cash quantity"
        );
        verify(orderRejectedKafkaTemplate, times(1)).send(
            ArgumentMatchers.eq(KafkaTopics.ORDER_REJECTED),
            ArgumentMatchers.eq(orderId.toString()),
            ArgumentMatchers.any(OrderRejectedEvent.class)
        );
        verify(orderAcceptedKafkaTemplate, never()).send(
            ArgumentMatchers.anyString(),
            ArgumentMatchers.anyString(),
            ArgumentMatchers.any(OrderAcceptedEvent.class)
        );
    }

    @Test
    void handleOrderSubmitted_buySufficientCash_accepts() throws Exception {
        UUID orderId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID cashInstrumentId = UUID.randomUUID();

        OrderSubmittedEvent event = new OrderSubmittedEvent(
            orderId,
            logOrderId,
            portfolioId,
            instrumentId,
            OrderSide.BUY,
            5.0,
            LocalDateTime.now(),
            7L
        );

        OrderLog pending = buildOrderLog(orderId, logOrderId, OrderStatus.PENDING);
        pending.setQuotedPrice(10.0);

        Instrument cashInstrument = new Instrument("USD_CASH", "USD", "US Dollar Cash Balance", InstrumentClass.USD);
        setField(cashInstrument, "instrumentId", cashInstrumentId);

        Holding cashHolding = new Holding(UUID.randomUUID(), portfolioId, cashInstrumentId);
        cashHolding.setCurrentQuantity(new BigDecimal("100"));

        when(orderLogService.appendPendingFromSystem(orderId, logOrderId)).thenReturn(pending);
        when(instrumentRepository.findByTickerIgnoreCase("USD_CASH")).thenReturn(Optional.of(cashInstrument));
        when(holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, cashInstrumentId))
            .thenReturn(Optional.of(cashHolding));
        when(orderLogService.appendAcceptedFromSystem(orderId, logOrderId))
            .thenReturn(buildOrderLog(orderId, logOrderId, OrderStatus.ACCEPTED));

        validationService.handleOrderSubmitted(event);

        verify(orderLogService, times(1)).appendAcceptedFromSystem(orderId, logOrderId);
        verify(orderAcceptedKafkaTemplate, times(1)).send(
            ArgumentMatchers.eq(KafkaTopics.ORDER_ACCEPTED),
            ArgumentMatchers.eq(orderId.toString()),
            ArgumentMatchers.any(OrderAcceptedEvent.class)
        );
        verify(orderRejectedKafkaTemplate, never()).send(
            ArgumentMatchers.anyString(),
            ArgumentMatchers.anyString(),
            ArgumentMatchers.any(OrderRejectedEvent.class)
        );
    }

    private OrderLog buildOrderLog(UUID orderId, UUID logOrderId, OrderStatus status) throws Exception {
        OrderLog orderLog = new OrderLog(
            orderId,
            new io.github.jackhudsonn.jaakd.model.Portfolio(new io.github.jackhudsonn.jaakd.model.Profile("v@test.com", BigDecimal.ZERO)),
            new io.github.jackhudsonn.jaakd.model.Instrument("AAPL", "NASDAQ", "Apple", io.github.jackhudsonn.jaakd.model.InstrumentClass.EQUITY),
            OrderSide.BUY,
            1.0
        );
        orderLog.setStatus(status);
        setField(orderLog, "orderID", orderId);
        setField(orderLog, "logOrderID", logOrderId);
        return orderLog;
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
