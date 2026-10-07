package io.github.jackhudsonn.jaakd.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.jackhudsonn.jaakd.dto.CreateOrderLogRequest;
import io.github.jackhudsonn.jaakd.exception.InstrumentNotFoundException;
import io.github.jackhudsonn.jaakd.exception.OrderCancellationConflictException;
import io.github.jackhudsonn.jaakd.exception.OrderLogNotFoundException;
import io.github.jackhudsonn.jaakd.exception.PortfolioNotFoundException;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class OrderLogService {
    private final OrderLogRepository orderLogRepository;
    private final PortfolioRepository portfolioRepository;
    private final InstrumentRepository instrumentRepository;
    private final CurrentUserService currentUserService;
    private final FifoAccountingService fifoAccountingService;
    private final PrivilegedAccessService privilegedAccessService;

    public OrderLogService(
        OrderLogRepository orderLogRepository,
        PortfolioRepository portfolioRepository,
        InstrumentRepository instrumentRepository,
        CurrentUserService currentUserService,
        FifoAccountingService fifoAccountingService,
        PrivilegedAccessService privilegedAccessService
    ) {
        this.orderLogRepository = orderLogRepository;
        this.portfolioRepository = portfolioRepository;
        this.instrumentRepository = instrumentRepository;
        this.currentUserService = currentUserService;
        this.fifoAccountingService = fifoAccountingService;
        this.privilegedAccessService = privilegedAccessService;
    }

    public List<OrderLog> getOrderLogsForPortfolio(UUID portfolioId) {
        UUID userId = currentUserService.getUserId();
        
        return orderLogRepository.findOwnedByPortfolioNewestFirst(portfolioId, userId);
    }

    public List<OrderLog> getOrderLogsForPortfolioDiagnostics(UUID portfolioId) {
        privilegedAccessService.ensureAdminOrAuditor();

        portfolioRepository.findById(portfolioId)
            .orElseThrow(() -> new PortfolioNotFoundException(portfolioId));

        return orderLogRepository.findByPortfolioPortfolioIdOrderByTimestampDesc(portfolioId);
    }

    public OrderLog getOrderLogById(UUID logOrderId) {
        UUID userId = currentUserService.getUserId();

        Optional<OrderLog> maybeOrderLog = orderLogRepository.findOwnedByLogOrderId(logOrderId, userId);
        
        if (maybeOrderLog.isEmpty()) {
            throw new OrderLogNotFoundException(logOrderId);
        }

        return maybeOrderLog.get();
    }

    @Transactional
    public OrderLog createOrderLog(CreateOrderLogRequest request) {
        // 1. Resolve current user
        UUID userId = currentUserService.getUserId();

        // 2. Ensure portfolio exists and belongs to user
        Optional<Portfolio> maybePortfolio = portfolioRepository.findOwnedByPortfolioId(request.portfolioId(), userId);
        
        if (maybePortfolio.isEmpty()) {
            throw new PortfolioNotFoundException(request.portfolioId());
        }

        Portfolio portfolio = maybePortfolio.get();

        // 3. Ensure instrument exists
        Optional<Instrument> maybeInstrument = instrumentRepository.findById(request.instrumentId());
        
        if (maybeInstrument.isEmpty()) {
            throw new InstrumentNotFoundException(request.instrumentId());
        }
        
        Instrument instrument = maybeInstrument.get();

        // 4. Build order log and defaults
        OrderLog orderLog = new OrderLog(
                request.orderId(),
                portfolio,
                instrument,
                request.side(),
                request.quantity()
        );

        orderLog.setStatus(OrderStatus.SUBMITTED);

        if (request.metadata() != null) {
            orderLog.setMetadata(request.metadata());
        }

        if (request.executionPrice() != null) {
            orderLog.setExecutionPrice(request.executionPrice());
        }

        // 5. Persist order log
        return orderLogRepository.save(orderLog);
    }

    @Transactional
    public OrderLog markExecuted(UUID logOrderId, Double executionPrice) {
        // 1. Load and authorize order log ownership
        UUID userId = currentUserService.getUserId();
        Optional<OrderLog> maybeOrderLog = orderLogRepository.findOwnedByLogOrderIdForUpdate(logOrderId, userId);
        if (maybeOrderLog.isEmpty()) {
            throw new OrderLogNotFoundException(logOrderId);
        }

        OrderLog orderLog = maybeOrderLog.get();

        // Idempotency guard: do not re-apply projections for an already executed log.
        if (orderLog.getStatus() == OrderStatus.EXECUTED) {
            if (executionPrice != null) {
                orderLog.setExecutionPrice(executionPrice);
                return orderLogRepository.save(orderLog);
            }
            return orderLog;
        }

        // 2. Apply execution state
        orderLog.setStatus(OrderStatus.EXECUTED);
        if (executionPrice != null) {
            orderLog.setExecutionPrice(executionPrice);
        }

        // 3. Persist transition first so downstream accounting can use the executed row
        OrderLog saved = orderLogRepository.save(orderLog);

        // 4. Apply FIFO accounting projections
        fifoAccountingService.applyExecution(saved);

        return saved;
    }

    @Transactional
    public OrderLog cancelOrder(UUID orderId) {
        UUID userId = currentUserService.getUserId();

        List<OrderLog> orderLogs = orderLogRepository.findOwnedByOrderIdNewestFirstForUpdate(orderId, userId);
        if (orderLogs.isEmpty()) {
            throw new OrderLogNotFoundException(orderId);
        }

        OrderLog latestOrderLog = orderLogs.get(0);
        OrderStatus latestStatus = latestOrderLog.getStatus();

        if (latestStatus == OrderStatus.CANCELLED) {
            return latestOrderLog;
        }

        if (latestStatus != OrderStatus.SUBMITTED && latestStatus != OrderStatus.PENDING) {
            throw new OrderCancellationConflictException(orderId, latestStatus);
        }

        OrderLog cancelledOrderLog = new OrderLog(
            latestOrderLog.getOrderId(),
            latestOrderLog.getPortfolio(),
            latestOrderLog.getInstrument(),
            latestOrderLog.getSide(),
            latestOrderLog.getQuantity()
        );
        cancelledOrderLog.setStatus(OrderStatus.CANCELLED);
        cancelledOrderLog.setMetadata(latestOrderLog.getMetadata());
        cancelledOrderLog.setExecutionPrice(latestOrderLog.getExecutionPrice());

        return orderLogRepository.save(cancelledOrderLog);
    }
}
