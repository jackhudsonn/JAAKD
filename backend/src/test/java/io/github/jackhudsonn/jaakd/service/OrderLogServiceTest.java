package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.OrderLogNotFoundException;
import io.github.jackhudsonn.jaakd.exception.PortfolioNotFoundException;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.Profile;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderLogServiceTest {

    @Mock
    private OrderLogRepository orderLogRepository;

    @Mock
    private PortfolioRepository portfolioRepository;

    @Mock
    private InstrumentRepository instrumentRepository;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private FifoAccountingService fifoAccountingService;

    @Mock
    private PrivilegedAccessService privilegedAccessService;

    @InjectMocks
    private OrderLogService orderLogService;

    @Test
    void markExecuted_setsExecutedStatus_savesAndCallsFifo() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();

        OrderLog orderLog = buildOrderLog(logOrderId, portfolioId, instrumentId, OrderSide.BUY, 10, 100);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(orderLogRepository.findOwnedByLogOrderIdForUpdate(logOrderId, userId)).thenReturn(Optional.of(orderLog));
        when(orderLogRepository.save(orderLog)).thenReturn(orderLog);

        OrderLog result = orderLogService.markExecuted(logOrderId, 120.0);

        assertEquals(OrderStatus.EXECUTED, result.getStatus());
        assertEquals(120.0, result.getExecutionPrice());

        ArgumentCaptor<OrderLog> saveCaptor = ArgumentCaptor.forClass(OrderLog.class);
        verify(orderLogRepository, times(1)).save(saveCaptor.capture());
        assertEquals(OrderStatus.EXECUTED, saveCaptor.getValue().getStatus());
        assertEquals(120.0, saveCaptor.getValue().getExecutionPrice());

        verify(fifoAccountingService, times(1)).applyExecution(orderLog);
    }

    @Test
    void markExecuted_withNullPriceKeepsExistingPriceAndCallsFifo() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();

        OrderLog orderLog = buildOrderLog(logOrderId, portfolioId, instrumentId, OrderSide.SELL, 5, 111.5);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(orderLogRepository.findOwnedByLogOrderIdForUpdate(logOrderId, userId)).thenReturn(Optional.of(orderLog));
        when(orderLogRepository.save(orderLog)).thenReturn(orderLog);

        OrderLog result = orderLogService.markExecuted(logOrderId, null);

        assertEquals(OrderStatus.EXECUTED, result.getStatus());
        assertEquals(111.5, result.getExecutionPrice());
        verify(fifoAccountingService, times(1)).applyExecution(orderLog);
    }

    @Test
    void markExecuted_notFoundThrowsAndDoesNotSaveOrApplyFifo() {
        UUID userId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();

        when(currentUserService.getUserId()).thenReturn(userId);
        when(orderLogRepository.findOwnedByLogOrderIdForUpdate(logOrderId, userId)).thenReturn(Optional.empty());

        assertThrows(OrderLogNotFoundException.class, () -> orderLogService.markExecuted(logOrderId, 100.0));

        verify(orderLogRepository, never()).save(org.mockito.ArgumentMatchers.any(OrderLog.class));
        verify(fifoAccountingService, never()).applyExecution(org.mockito.ArgumentMatchers.any(OrderLog.class));
    }

    @Test
    void markExecuted_alreadyExecutedWithNoNewPrice_skipsSaveAndFifo() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();

        OrderLog orderLog = buildOrderLog(logOrderId, portfolioId, instrumentId, OrderSide.BUY, 10, 101.0);
        orderLog.setStatus(OrderStatus.EXECUTED);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(orderLogRepository.findOwnedByLogOrderIdForUpdate(logOrderId, userId)).thenReturn(Optional.of(orderLog));

        OrderLog result = orderLogService.markExecuted(logOrderId, null);

        assertEquals(OrderStatus.EXECUTED, result.getStatus());
        assertEquals(101.0, result.getExecutionPrice());
        verify(orderLogRepository, never()).save(any(OrderLog.class));
        verify(fifoAccountingService, never()).applyExecution(any(OrderLog.class));
    }

    @Test
    void markExecuted_alreadyExecutedWithNewPrice_updatesPriceWithoutFifo() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();

        OrderLog orderLog = buildOrderLog(logOrderId, portfolioId, instrumentId, OrderSide.BUY, 10, 101.0);
        orderLog.setStatus(OrderStatus.EXECUTED);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(orderLogRepository.findOwnedByLogOrderIdForUpdate(logOrderId, userId)).thenReturn(Optional.of(orderLog));
        when(orderLogRepository.save(orderLog)).thenReturn(orderLog);

        OrderLog result = orderLogService.markExecuted(logOrderId, 102.5);

        assertEquals(OrderStatus.EXECUTED, result.getStatus());
        assertEquals(102.5, result.getExecutionPrice());
        verify(orderLogRepository, times(1)).save(orderLog);
        verify(fifoAccountingService, never()).applyExecution(any(OrderLog.class));
    }

    @Test
    void markExecuted_depositCalledTwice_appliesAccountingOnlyOnce() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();

        OrderLog orderLog = buildOrderLog(logOrderId, portfolioId, instrumentId, OrderSide.DEPOSIT, 500, 1.0);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(orderLogRepository.findOwnedByLogOrderIdForUpdate(logOrderId, userId)).thenReturn(Optional.of(orderLog));
        when(orderLogRepository.save(orderLog)).thenReturn(orderLog);

        orderLogService.markExecuted(logOrderId, null);
        orderLogService.markExecuted(logOrderId, null);

        verify(orderLogRepository, times(1)).save(orderLog);
        verify(fifoAccountingService, times(1)).applyExecution(orderLog);
    }

    @Test
    void markExecuted_withdrawCalledTwice_appliesAccountingOnlyOnce() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();

        OrderLog orderLog = buildOrderLog(logOrderId, portfolioId, instrumentId, OrderSide.WITHDRAW, 200, 1.0);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(orderLogRepository.findOwnedByLogOrderIdForUpdate(logOrderId, userId)).thenReturn(Optional.of(orderLog));
        when(orderLogRepository.save(orderLog)).thenReturn(orderLog);

        orderLogService.markExecuted(logOrderId, null);
        orderLogService.markExecuted(logOrderId, null);

        verify(orderLogRepository, times(1)).save(orderLog);
        verify(fifoAccountingService, times(1)).applyExecution(orderLog);
    }

    @Test
    void getOrderLogsForPortfolioDiagnostics_privilegedUserGetsNewestFirst() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();

        Portfolio portfolio = new Portfolio(new Profile("owner@test.com", BigDecimal.ZERO));
        setField(portfolio, "portfolioId", portfolioId);

        OrderLog newer = buildOrderLog(UUID.randomUUID(), portfolioId, instrumentId, OrderSide.BUY, 1, 101);
        OrderLog older = buildOrderLog(UUID.randomUUID(), portfolioId, instrumentId, OrderSide.BUY, 1, 100);

        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(orderLogRepository.findByPortfolioPortfolioIdOrderByTimestampDesc(portfolioId))
            .thenReturn(java.util.List.of(newer, older));

        java.util.List<OrderLog> result = orderLogService.getOrderLogsForPortfolioDiagnostics(portfolioId);

        assertIterableEquals(java.util.List.of(newer, older), result);
        verify(privilegedAccessService, times(1)).ensureAdminOrAuditor();
    }

    @Test
    void getOrderLogsForPortfolioDiagnostics_missingPortfolioThrows() {
        UUID portfolioId = UUID.randomUUID();
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.empty());

        assertThrows(PortfolioNotFoundException.class, () -> orderLogService.getOrderLogsForPortfolioDiagnostics(portfolioId));

        verify(privilegedAccessService, times(1)).ensureAdminOrAuditor();
        verify(orderLogRepository, never()).findByPortfolioPortfolioIdOrderByTimestampDesc(portfolioId);
    }

    private OrderLog buildOrderLog(
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
        orderLog.setStatus(OrderStatus.SUBMITTED);
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
