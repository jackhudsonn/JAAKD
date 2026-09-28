package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.PortfolioReconciliationResponse;
import io.github.jackhudsonn.jaakd.exception.ForbiddenException;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.Profile;
import io.github.jackhudsonn.jaakd.model.UserType;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PortfolioReconciliationServiceTest {

    @Mock
    private PortfolioRepository portfolioRepository;

    @Mock
    private OrderLogRepository orderLogRepository;

    @Mock
    private HoldingRepository holdingRepository;

    @Mock
    private PrivilegedAccessService privilegedAccessService;

    @InjectMocks
    private PortfolioReconciliationService reconciliationService;

    @Test
    void reconcilePortfolio_matchingProjectionHasNoMismatches() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        UUID equityId = UUID.randomUUID();
        UUID cashId = UUID.randomUUID();

        Portfolio portfolio = buildPortfolio(portfolioId);

        List<OrderLog> executedLogs = List.of(
            buildExecutedLog(portfolio, equityId, OrderSide.BUY, 100, 110),
            buildExecutedLog(portfolio, equityId, OrderSide.SELL, 40, 120),
            buildExecutedLog(portfolio, cashId, OrderSide.DEPOSIT, 1000, 1),
            buildExecutedLog(portfolio, cashId, OrderSide.WITHDRAW, 250, 1)
        );

        Holding equityHolding = new Holding(UUID.randomUUID(), portfolioId, equityId);
        equityHolding.setCurrentQuantity(new BigDecimal("60.0"));
        equityHolding.setCumulativeRealizedPnl(new BigDecimal("400.0"));

        Holding cashHolding = new Holding(UUID.randomUUID(), portfolioId, cashId);
        cashHolding.setCurrentQuantity(new BigDecimal("750.0"));
        cashHolding.setCumulativeRealizedPnl(BigDecimal.ZERO);

        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(orderLogRepository.findByPortfolioPortfolioIdAndStatusOrderByTimestampAsc(portfolioId, OrderStatus.EXECUTED))
            .thenReturn(executedLogs);
        when(holdingRepository.findByPortfolioID(portfolioId)).thenReturn(List.of(equityHolding, cashHolding));

        PortfolioReconciliationResponse response = reconciliationService.reconcilePortfolio(portfolioId);

        assertEquals(4, response.executedLogCount());
        assertEquals(2, response.holdingCount());
        assertEquals(0, response.mismatchCount());
        assertFalse(response.hasMismatches());
    }

    @Test
    void reconcilePortfolio_detectsCashMismatchInSummary() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        UUID cashId = UUID.randomUUID();

        Portfolio portfolio = buildPortfolio(portfolioId);

        List<OrderLog> executedLogs = List.of(
            buildExecutedLog(portfolio, cashId, OrderSide.DEPOSIT, 1000, 1),
            buildExecutedLog(portfolio, cashId, OrderSide.WITHDRAW, 200, 1)
        );

        Holding cashHolding = new Holding(UUID.randomUUID(), portfolioId, cashId);
        cashHolding.setCurrentQuantity(new BigDecimal("700.0"));
        cashHolding.setCumulativeRealizedPnl(BigDecimal.ZERO);

        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(orderLogRepository.findByPortfolioPortfolioIdAndStatusOrderByTimestampAsc(portfolioId, OrderStatus.EXECUTED))
            .thenReturn(executedLogs);
        when(holdingRepository.findByPortfolioID(portfolioId)).thenReturn(List.of(cashHolding));

        PortfolioReconciliationResponse response = reconciliationService.reconcilePortfolio(portfolioId);

        assertTrue(response.hasMismatches());
        assertEquals(1, response.mismatchCount());
        assertEquals(cashId, response.mismatches().get(0).instrumentId());
        assertEquals(800.0, response.mismatches().get(0).expectedQuantity());
        assertEquals(700.0, response.mismatches().get(0).actualQuantity());
    }

    @Test
    void reconcilePortfolio_retailClientIsForbidden() {
        UUID portfolioId = UUID.randomUUID();
        doThrow(new ForbiddenException("Admin or auditor user type is required"))
            .when(privilegedAccessService).ensureAdminOrAuditor();

        assertThrows(ForbiddenException.class, () -> reconciliationService.reconcilePortfolio(portfolioId));
    }

    private Portfolio buildPortfolio(UUID portfolioId) throws Exception {
        Profile profile = new Profile("reconcile@test.com", BigDecimal.ZERO);
        Portfolio portfolio = new Portfolio(profile);
        setField(portfolio, "portfolioId", portfolioId);
        return portfolio;
    }

    private OrderLog buildExecutedLog(
        Portfolio portfolio,
        UUID instrumentId,
        OrderSide side,
        double quantity,
        double executionPrice
    ) throws Exception {
        Instrument instrument = new Instrument("SYM", "MKT", "Name", InstrumentClass.EQUITY);
        setField(instrument, "instrumentId", instrumentId);

        OrderLog log = new OrderLog(UUID.randomUUID(), portfolio, instrument, side, quantity);
        log.setStatus(OrderStatus.EXECUTED);
        log.setExecutionPrice(executionPrice);
        return log;
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
