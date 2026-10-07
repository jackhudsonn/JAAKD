package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.event.OrderAcceptedEvent;
import io.github.jackhudsonn.jaakd.exception.InvalidTradeException;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.Profile;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExecutionServiceTest {

    @Mock
    private OrderLogService orderLogService;

    @Mock
    private FifoAccountingService fifoAccountingService;

    @InjectMocks
    private ExecutionService executionService;

    @Test
    void handleOrderAccepted_nullEvent_noop() {
        executionService.handleOrderAccepted(null);

        verify(orderLogService, never()).getLatestOrderLogByOrderIdForUpdate(org.mockito.ArgumentMatchers.any());
        verify(fifoAccountingService, never()).applyExecution(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void handleOrderAccepted_latestExecuted_noop() throws Exception {
        UUID orderId = UUID.randomUUID();
        OrderAcceptedEvent event = new OrderAcceptedEvent(orderId, UUID.randomUUID(), LocalDateTime.now());
        OrderLog latest = buildOrderLog(orderId, OrderStatus.EXECUTED);

        when(orderLogService.getLatestOrderLogByOrderIdForUpdate(orderId)).thenReturn(latest);

        executionService.handleOrderAccepted(event);

        verify(fifoAccountingService, never()).applyExecution(org.mockito.ArgumentMatchers.any());
        verify(orderLogService, never()).appendExecutedFromSystem(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any()
        );
        verify(orderLogService, never()).appendFailedFromSystem(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any()
        );
    }

    @Test
    void handleOrderAccepted_latestFailed_noop() throws Exception {
        UUID orderId = UUID.randomUUID();
        OrderAcceptedEvent event = new OrderAcceptedEvent(orderId, UUID.randomUUID(), LocalDateTime.now());
        OrderLog latest = buildOrderLog(orderId, OrderStatus.FAILED);

        when(orderLogService.getLatestOrderLogByOrderIdForUpdate(orderId)).thenReturn(latest);

        executionService.handleOrderAccepted(event);

        verify(fifoAccountingService, never()).applyExecution(org.mockito.ArgumentMatchers.any());
        verify(orderLogService, never()).appendExecutedFromSystem(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any()
        );
        verify(orderLogService, never()).appendFailedFromSystem(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any()
        );
    }

    @Test
    void handleOrderAccepted_latestNotAccepted_throws() throws Exception {
        UUID orderId = UUID.randomUUID();
        OrderAcceptedEvent event = new OrderAcceptedEvent(orderId, UUID.randomUUID(), LocalDateTime.now());
        OrderLog latest = buildOrderLog(orderId, OrderStatus.SUBMITTED);

        when(orderLogService.getLatestOrderLogByOrderIdForUpdate(orderId)).thenReturn(latest);

        assertThrows(InvalidTradeException.class, () -> executionService.handleOrderAccepted(event));
        verify(fifoAccountingService, never()).applyExecution(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void handleOrderAccepted_success_appendsExecuted() throws Exception {
        UUID orderId = UUID.randomUUID();
        UUID sourceLogOrderId = UUID.randomUUID();
        OrderAcceptedEvent event = new OrderAcceptedEvent(orderId, sourceLogOrderId, LocalDateTime.now());
        OrderLog latest = buildOrderLog(orderId, OrderStatus.ACCEPTED);

        when(orderLogService.getLatestOrderLogByOrderIdForUpdate(orderId)).thenReturn(latest);
        when(fifoAccountingService.applyExecution(latest))
            .thenReturn(new FifoAccountingService.ExecutionOutcome(true, null, 123.45));

        executionService.handleOrderAccepted(event);

        verify(fifoAccountingService, times(1)).applyExecution(latest);

        ArgumentCaptor<Double> priceCaptor = ArgumentCaptor.forClass(Double.class);
        verify(orderLogService, times(1)).appendExecutedFromSystem(
            org.mockito.ArgumentMatchers.eq(orderId),
            org.mockito.ArgumentMatchers.eq(sourceLogOrderId),
            priceCaptor.capture()
        );
        org.junit.jupiter.api.Assertions.assertEquals(123.45, priceCaptor.getValue());

        verify(orderLogService, never()).appendFailedFromSystem(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any()
        );
    }

    @Test
    void handleOrderAccepted_failure_appendsFailed() throws Exception {
        UUID orderId = UUID.randomUUID();
        UUID sourceLogOrderId = UUID.randomUUID();
        OrderAcceptedEvent event = new OrderAcceptedEvent(orderId, sourceLogOrderId, LocalDateTime.now());
        OrderLog latest = buildOrderLog(orderId, OrderStatus.ACCEPTED);

        when(orderLogService.getLatestOrderLogByOrderIdForUpdate(orderId)).thenReturn(latest);
        when(fifoAccountingService.applyExecution(latest))
            .thenReturn(new FifoAccountingService.ExecutionOutcome(false, "Insufficient quantity", 99.0));

        executionService.handleOrderAccepted(event);

        verify(fifoAccountingService, times(1)).applyExecution(latest);
        verify(orderLogService, times(1)).appendFailedFromSystem(
            org.mockito.ArgumentMatchers.eq(orderId),
            org.mockito.ArgumentMatchers.eq(sourceLogOrderId),
            org.mockito.ArgumentMatchers.eq("Insufficient quantity"),
            org.mockito.ArgumentMatchers.eq(99.0)
        );
        verify(orderLogService, never()).appendExecutedFromSystem(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any()
        );
    }

    private OrderLog buildOrderLog(UUID orderId, OrderStatus status) throws Exception {
        Profile profile = new Profile(UUID.randomUUID(), BigDecimal.ZERO);
        Portfolio portfolio = new Portfolio(profile);

        Instrument instrument = new Instrument("AAPL", "NASDAQ", "Apple", InstrumentClass.EQUITY);

        OrderLog orderLog = new OrderLog(orderId, portfolio, instrument, OrderSide.BUY, 10.0);
        orderLog.setStatus(status);
        orderLog.setExecutionPrice(100.0);
        setField(orderLog, "orderID", orderId);

        return orderLog;
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
