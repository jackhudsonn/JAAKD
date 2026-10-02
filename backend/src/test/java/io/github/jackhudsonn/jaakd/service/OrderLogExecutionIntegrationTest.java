package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.BackendApplication;
import io.github.jackhudsonn.jaakd.dto.LotMatchResponse;
import io.github.jackhudsonn.jaakd.dto.PositionLotResponse;
import io.github.jackhudsonn.jaakd.event.OrderAcceptedEvent;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.LotMatch;
import io.github.jackhudsonn.jaakd.model.Profile;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.LotMatchRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import io.github.jackhudsonn.jaakd.repository.PositionLotRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(
    classes = BackendApplication.class,
    properties = {
        "spring.kafka.listener.auto-startup=false"
    }
)
@ActiveProfiles("test")
@Transactional
class OrderLogExecutionIntegrationTest {

    @Autowired
    private OrderLogService orderLogService;

    @Autowired
    private ExecutionService executionService;

    @Autowired
    private ValidationService validationService;

    @Autowired
    private HoldingService holdingService;

    @Autowired
    private OrderLogRepository orderLogRepository;

    @Autowired
    private PortfolioRepository portfolioRepository;

    @Autowired
    private HoldingRepository holdingRepository;

    @Autowired
    private PositionLotRepository positionLotRepository;

    @Autowired
    private LotMatchRepository lotMatchRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void markExecuted_depositThenWithdraw_updatesCashHoldingWithoutLotRows() {
        Portfolio portfolio = createOwnedPortfolio();
        setAuthenticatedUser(portfolio.getProfile().getUserId());
        Instrument cashInstrument = createCashInstrument();

        OrderLog depositLog = createAcceptedOrderLog(portfolio, cashInstrument, OrderSide.DEPOSIT, 1000.0);
        executeAcceptedOrderLog(depositLog);

        Optional<Holding> maybeHoldingAfterDeposit = holdingRepository.findByPortfolioIDAndInstrumentID(
            portfolio.getPortfolioId(),
            cashInstrument.getInstrumentId()
        );
        assertTrue(maybeHoldingAfterDeposit.isPresent());
        assertEquals(new BigDecimal("1000.0"), maybeHoldingAfterDeposit.get().getCurrentQuantity());

        OrderLog withdrawLog = createAcceptedOrderLog(portfolio, cashInstrument, OrderSide.WITHDRAW, 250.0);
        executeAcceptedOrderLog(withdrawLog);

        Holding holdingAfterWithdraw = holdingRepository.findByPortfolioIDAndInstrumentID(
            portfolio.getPortfolioId(),
            cashInstrument.getInstrumentId()
        ).orElseThrow();
        assertEquals(new BigDecimal("750.0"), holdingAfterWithdraw.getCurrentQuantity());

        assertEquals(0, positionLotRepository.count());
        assertEquals(0, lotMatchRepository.count());

        List<OrderLog> depositLifecycle = orderLogRepository.findByOrderIDOrderByTimestampAsc(depositLog.getOrderId());
        List<OrderLog> withdrawLifecycle = orderLogRepository.findByOrderIDOrderByTimestampAsc(withdrawLog.getOrderId());
        assertEquals(OrderStatus.EXECUTED, depositLifecycle.get(depositLifecycle.size() - 1).getStatus());
        assertEquals(OrderStatus.EXECUTED, withdrawLifecycle.get(withdrawLifecycle.size() - 1).getStatus());
    }

    @Test
    void markExecuted_fullLifecycle_depositBuysSellWithdraw_projectsExpectedState() {
        Portfolio portfolio = createOwnedPortfolio();
        setAuthenticatedUser(portfolio.getProfile().getUserId());

        Instrument cashInstrument = createCashInstrument();
        Instrument equityInstrument = createEquityInstrument();

        OrderLog deposit = createAcceptedOrderLog(portfolio, cashInstrument, OrderSide.DEPOSIT, 5000.0);
        executeAcceptedOrderLog(deposit);

        OrderLog buyOne = createAcceptedOrderLog(portfolio, equityInstrument, OrderSide.BUY, 10.0);
        executeAcceptedOrderLog(buyOne);

        OrderLog buyTwo = createAcceptedOrderLog(portfolio, equityInstrument, OrderSide.BUY, 5.0);
        executeAcceptedOrderLog(buyTwo);

        OrderLog sell = createAcceptedOrderLog(portfolio, equityInstrument, OrderSide.SELL, 8.0);
        executeAcceptedOrderLog(sell);

        OrderLog withdraw = createAcceptedOrderLog(portfolio, cashInstrument, OrderSide.WITHDRAW, 1000.0);
        executeAcceptedOrderLog(withdraw);

        Holding cashHolding = holdingRepository.findByPortfolioIDAndInstrumentID(
            portfolio.getPortfolioId(),
            cashInstrument.getInstrumentId()
        ).orElseThrow();

        Holding equityHolding = holdingRepository.findByPortfolioIDAndInstrumentID(
            portfolio.getPortfolioId(),
            equityInstrument.getInstrumentId()
        ).orElseThrow();

        assertEquals(new BigDecimal("3300.00"), cashHolding.getCurrentQuantity());
        assertEquals(new BigDecimal("7.0"), equityHolding.getCurrentQuantity());
        assertEquals(new BigDecimal("0.00"), equityHolding.getCumulativeRealizedPnl().setScale(2));

        assertEquals(2, positionLotRepository.count());
        assertEquals(1, lotMatchRepository.count());

        List<LotMatch> sellMatches = lotMatchRepository.findBySellLogOrderID(sell.getLogOrderID());
        assertEquals(1, sellMatches.size());
        assertEquals(new BigDecimal("8.0"), sellMatches.get(0).getMatchedQuantity());
        assertEquals(new BigDecimal("0.00"), sellMatches.get(0).getRealizedPnlAmount().setScale(2));

        assertEquals(OrderStatus.EXECUTED, latestStatus(deposit.getOrderId()));
        assertEquals(OrderStatus.EXECUTED, latestStatus(buyOne.getOrderId()));
        assertEquals(OrderStatus.EXECUTED, latestStatus(buyTwo.getOrderId()));
        assertEquals(OrderStatus.EXECUTED, latestStatus(sell.getOrderId()));
        assertEquals(OrderStatus.EXECUTED, latestStatus(withdraw.getOrderId()));

        List<PositionLotResponse> lotResponses = holdingService.getPositionLotsForHolding(equityHolding.getHoldingID());
        List<LotMatchResponse> lotMatchResponses = holdingService.getLotMatchesForHolding(equityHolding.getHoldingID());

        assertEquals(2, lotResponses.size());
        assertEquals(1, lotMatchResponses.size());
        assertEquals(new BigDecimal("8.0"), lotMatchResponses.get(0).matchedQuantity());
        assertEquals(new BigDecimal("0.00"), lotMatchResponses.get(0).realizedPnlAmount().setScale(2));
    }

    @Test
    void cancelOrder_appendOnlyAndIdempotent_withoutProjectionSideEffects() {
        Portfolio portfolio = createOwnedPortfolio();
        setAuthenticatedUser(portfolio.getProfile().getUserId());
        Instrument equityInstrument = createEquityInstrument();

        OrderLog submitted = createSubmittedOrderLog(portfolio, equityInstrument, OrderSide.BUY, 3.0);
        UUID orderId = submitted.getOrderId();

        OrderLog firstCancel = orderLogService.cancelOrder(orderId);
        assertEquals(OrderStatus.CANCELLED, firstCancel.getStatus());

        List<OrderLog> logsAfterFirstCancel = orderLogRepository.findByOrderIDOrderByTimestampAsc(orderId);
        assertEquals(2, logsAfterFirstCancel.size());
        assertEquals(OrderStatus.SUBMITTED, logsAfterFirstCancel.get(0).getStatus());
        assertEquals(OrderStatus.CANCELLED, logsAfterFirstCancel.get(1).getStatus());

        OrderLog secondCancel = orderLogService.cancelOrder(orderId);
        assertEquals(firstCancel.getLogOrderID(), secondCancel.getLogOrderID());

        List<OrderLog> logsAfterSecondCancel = orderLogRepository.findByOrderIDOrderByTimestampAsc(orderId);
        assertEquals(2, logsAfterSecondCancel.size());

        assertEquals(0, positionLotRepository.count());
        assertEquals(0, lotMatchRepository.count());
        assertTrue(holdingRepository.findByPortfolioID(portfolio.getPortfolioId()).isEmpty());
    }

    @Test
    @Disabled("Requires Kafka broker for validation event publication path")
    void validation_afterCancellation_doesNotAppendPendingOrOutcomeStatuses() {
        Portfolio portfolio = createOwnedPortfolio();
        setAuthenticatedUser(portfolio.getProfile().getUserId());
        Instrument equityInstrument = createEquityInstrument();

        OrderLog submitted = createSubmittedOrderLog(portfolio, equityInstrument, OrderSide.BUY, 3.0);
        UUID orderId = submitted.getOrderId();

        orderLogService.cancelOrder(orderId);

        io.github.jackhudsonn.jaakd.event.OrderSubmittedEvent event = new io.github.jackhudsonn.jaakd.event.OrderSubmittedEvent(
            submitted.getOrderId(),
            submitted.getLogOrderID(),
            portfolio.getPortfolioId(),
            equityInstrument.getInstrumentId(),
            OrderSide.BUY,
            submitted.getQuantity(),
            LocalDateTime.now(),
            1L
        );
        validationService.handleOrderSubmitted(event);

        List<OrderLog> lifecycle = orderLogRepository.findByOrderIDOrderByTimestampAsc(orderId);
        assertEquals(2, lifecycle.size());
        assertEquals(OrderStatus.SUBMITTED, lifecycle.get(0).getStatus());
        assertEquals(OrderStatus.CANCELLED, lifecycle.get(1).getStatus());
    }

    @Test
    @Disabled("Requires Kafka broker for validation event publication path")
    void validation_buyWithInsufficientCash_appendsRejectedLifecycle() {
        Portfolio portfolio = createOwnedPortfolio();
        setAuthenticatedUser(portfolio.getProfile().getUserId());
        Instrument cashInstrument = createCashInstrument();
        Instrument equityInstrument = createEquityInstrument();

        createHolding(portfolio.getPortfolioId(), cashInstrument.getInstrumentId(), new BigDecimal("2.0"));
        OrderLog submitted = createSubmittedOrderLog(portfolio, equityInstrument, OrderSide.BUY, 5.0);

        io.github.jackhudsonn.jaakd.event.OrderSubmittedEvent event = new io.github.jackhudsonn.jaakd.event.OrderSubmittedEvent(
            submitted.getOrderId(),
            submitted.getLogOrderID(),
            portfolio.getPortfolioId(),
            equityInstrument.getInstrumentId(),
            OrderSide.BUY,
            submitted.getQuantity(),
            LocalDateTime.now(),
            1L
        );
        validationService.handleOrderSubmitted(event);

        List<OrderLog> lifecycle = orderLogRepository.findByOrderIDOrderByTimestampAsc(submitted.getOrderId());
        assertEquals(3, lifecycle.size());
        assertEquals(OrderStatus.SUBMITTED, lifecycle.get(0).getStatus());
        assertEquals(OrderStatus.PENDING, lifecycle.get(1).getStatus());
        assertEquals(OrderStatus.REJECTED, lifecycle.get(2).getStatus());
        assertTrue(lifecycle.get(2).getMetadata().contains("Cannot buy more than current cash quantity"));
    }

    @Test
    @Disabled("Requires Kafka broker for validation event publication path")
    void validation_buyWithSufficientCash_appendsAcceptedLifecycle() {
        Portfolio portfolio = createOwnedPortfolio();
        setAuthenticatedUser(portfolio.getProfile().getUserId());
        Instrument cashInstrument = createCashInstrument();
        Instrument equityInstrument = createEquityInstrument();

        createHolding(portfolio.getPortfolioId(), cashInstrument.getInstrumentId(), new BigDecimal("20.0"));
        OrderLog submitted = createSubmittedOrderLog(portfolio, equityInstrument, OrderSide.BUY, 5.0);

        io.github.jackhudsonn.jaakd.event.OrderSubmittedEvent event = new io.github.jackhudsonn.jaakd.event.OrderSubmittedEvent(
            submitted.getOrderId(),
            submitted.getLogOrderID(),
            portfolio.getPortfolioId(),
            equityInstrument.getInstrumentId(),
            OrderSide.BUY,
            submitted.getQuantity(),
            LocalDateTime.now(),
            1L
        );
        validationService.handleOrderSubmitted(event);

        List<OrderLog> lifecycle = orderLogRepository.findByOrderIDOrderByTimestampAsc(submitted.getOrderId());
        assertEquals(3, lifecycle.size());
        assertEquals(OrderStatus.SUBMITTED, lifecycle.get(0).getStatus());
        assertEquals(OrderStatus.PENDING, lifecycle.get(1).getStatus());
        assertEquals(OrderStatus.ACCEPTED, lifecycle.get(2).getStatus());
    }

    private Portfolio createOwnedPortfolio() {
        Profile profile = new Profile("cash-test@example.com", BigDecimal.ZERO);
        entityManager.persist(profile);
        entityManager.flush();

        Portfolio portfolio = new Portfolio(profile);
        portfolio.setPortfolioName("Integration Cash Portfolio");
        return portfolioRepository.save(portfolio);
    }

    private Instrument createCashInstrument() {
        Instrument instrument = new Instrument("USD", "CASH", "US Dollar Cash", InstrumentClass.CASH);
        entityManager.persist(instrument);
        entityManager.flush();
        return instrument;
    }

    private Instrument createEquityInstrument() {
        Instrument instrument = new Instrument("AAPL", "NASDAQ", "Apple Inc.", InstrumentClass.EQUITY);
        entityManager.persist(instrument);
        entityManager.flush();
        return instrument;
    }

    private OrderLog createAcceptedOrderLog(Portfolio portfolio, Instrument instrument, OrderSide side, double quantity) {
        OrderLog log = new OrderLog(UUID.randomUUID(), portfolio, instrument, side, quantity);
        log.setStatus(OrderStatus.ACCEPTED);
        log.setExecutionPrice(1.0);
        return orderLogRepository.save(log);
    }

    private OrderLog createSubmittedOrderLog(Portfolio portfolio, Instrument instrument, OrderSide side, double quantity) {
        OrderLog log = new OrderLog(UUID.randomUUID(), portfolio, instrument, side, quantity);
        log.setStatus(OrderStatus.SUBMITTED);
        log.setExecutionPrice(1.0);
        return orderLogRepository.save(log);
    }

    private Holding createHolding(UUID portfolioId, UUID instrumentId, BigDecimal quantity) {
        Holding holding = new Holding(portfolioId, instrumentId);
        holding.setCurrentQuantity(quantity);
        return holdingRepository.save(holding);
    }

    private void executeAcceptedOrderLog(OrderLog acceptedLog) {
        OrderAcceptedEvent event = new OrderAcceptedEvent(
            acceptedLog.getOrderId(),
            acceptedLog.getLogOrderID(),
            LocalDateTime.now(),
            1L
        );
        executionService.handleOrderAccepted(event);
    }

    private OrderStatus latestStatus(UUID orderId) {
        List<OrderLog> lifecycle = orderLogRepository.findByOrderIDOrderByTimestampAsc(orderId);
        return lifecycle.get(lifecycle.size() - 1).getStatus();
    }

    private void setAuthenticatedUser(UUID userId) {
        Jwt jwt = Jwt.withTokenValue("test-token")
            .header("alg", "none")
            .subject(userId.toString())
            .build();

        UsernamePasswordAuthenticationToken authentication =
            new UsernamePasswordAuthenticationToken(jwt, null, java.util.Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
