package io.github.jackhudsonn.jaakd.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.kafka.core.KafkaTemplate;

import io.github.jackhudsonn.jaakd.config.KafkaTopics;
import io.github.jackhudsonn.jaakd.dto.CreateOrderLogRequest;
import io.github.jackhudsonn.jaakd.event.OrderSubmittedEvent;
import io.github.jackhudsonn.jaakd.exception.InstrumentNotFoundException;
import io.github.jackhudsonn.jaakd.exception.InvalidTradeException;
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
    private final PrivilegedAccessService privilegedAccessService;
    private final MockQuoteService quoteService;
    private final KafkaTemplate<String, OrderSubmittedEvent> orderSubmittedKafkaTemplate;

    public OrderLogService(
        OrderLogRepository orderLogRepository,
        PortfolioRepository portfolioRepository,
        InstrumentRepository instrumentRepository,
        CurrentUserService currentUserService,
        PrivilegedAccessService privilegedAccessService,
        MockQuoteService quoteService,
        KafkaTemplate<String, OrderSubmittedEvent> orderSubmittedKafkaTemplate
    ) {
        this.orderLogRepository = orderLogRepository;
        this.portfolioRepository = portfolioRepository;
        this.instrumentRepository = instrumentRepository;
        this.currentUserService = currentUserService;
        this.privilegedAccessService = privilegedAccessService;
        this.quoteService = quoteService;
        this.orderSubmittedKafkaTemplate = orderSubmittedKafkaTemplate;
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

        orderLog.setQuotedPrice(quoteService.getExecutionPrice(instrument.getInstrumentId()));

        if (request.executionPrice() != null) {
            orderLog.setExecutionPrice(request.executionPrice());
        }

        // 5. Persist order log
        OrderLog saved = orderLogRepository.save(orderLog);

        // 6. Publish submitted event for async validation lifecycle.
        OrderSubmittedEvent event = new OrderSubmittedEvent(
            saved.getOrderId(),
            saved.getLogOrderID(),
            saved.getPortfolio().getPortfolioId(),
            saved.getInstrument().getInstrumentId(),
            saved.getSide(),
            saved.getQuantity(),
            saved.getTimeStamp()
        );
        String partitionKey = saved.getInstrument().getTicker();
        orderSubmittedKafkaTemplate.send(KafkaTopics.ORDER_SUBMITTED, partitionKey, event);

        return saved;
    }

    @Transactional
    public OrderLog appendPendingFromSystem(UUID orderId, UUID sourceLogOrderId) {
        List<OrderLog> orderLogs = orderLogRepository.findByOrderIdNewestFirstForUpdate(orderId);
        if (orderLogs.isEmpty()) {
            throw new OrderLogNotFoundException(orderId);
        }

        OrderLog latestOrderLog = orderLogs.get(0);
        if (latestOrderLog.getStatus() == OrderStatus.PENDING) {
            return latestOrderLog;
        }
        if (latestOrderLog.getStatus() == OrderStatus.CANCELLED) {
            return latestOrderLog;
        }
        if (latestOrderLog.getStatus() != OrderStatus.SUBMITTED) {
            throw new InvalidTradeException(
                "Cannot mark PENDING for order " + orderId + " while latest status is " + latestOrderLog.getStatus()
            );
        }

        OrderLog pendingOrderLog = new OrderLog(
            latestOrderLog.getOrderId(),
            latestOrderLog.getPortfolio(),
            latestOrderLog.getInstrument(),
            latestOrderLog.getSide(),
            latestOrderLog.getQuantity()
        );
        pendingOrderLog.setStatus(OrderStatus.PENDING);
        pendingOrderLog.setMetadata(latestOrderLog.getMetadata());
        pendingOrderLog.setExecutionPrice(latestOrderLog.getExecutionPrice());
        pendingOrderLog.setQuotedPrice(latestOrderLog.getQuotedPrice());

        return orderLogRepository.save(pendingOrderLog);
    }

    @Transactional
    public OrderLog appendAcceptedFromSystem(UUID orderId, UUID sourceLogOrderId) {
        List<OrderLog> orderLogs = orderLogRepository.findByOrderIdNewestFirstForUpdate(orderId);
        if (orderLogs.isEmpty()) {
            throw new OrderLogNotFoundException(orderId);
        }

        OrderLog latestOrderLog = orderLogs.get(0);
        if (latestOrderLog.getStatus() == OrderStatus.ACCEPTED) {
            return latestOrderLog;
        }
        if (latestOrderLog.getStatus() == OrderStatus.CANCELLED) {
            return latestOrderLog;
        }
        if (latestOrderLog.getStatus() != OrderStatus.SUBMITTED && latestOrderLog.getStatus() != OrderStatus.PENDING) {
            throw new InvalidTradeException(
                "Cannot mark ACCEPTED for order " + orderId + " while latest status is " + latestOrderLog.getStatus()
            );
        }

        OrderLog acceptedOrderLog = new OrderLog(
            latestOrderLog.getOrderId(),
            latestOrderLog.getPortfolio(),
            latestOrderLog.getInstrument(),
            latestOrderLog.getSide(),
            latestOrderLog.getQuantity()
        );
        acceptedOrderLog.setStatus(OrderStatus.ACCEPTED);
        acceptedOrderLog.setMetadata(latestOrderLog.getMetadata());
        acceptedOrderLog.setExecutionPrice(latestOrderLog.getExecutionPrice());
        acceptedOrderLog.setQuotedPrice(latestOrderLog.getQuotedPrice());

        return orderLogRepository.save(acceptedOrderLog);
    }

    @Transactional
    public OrderLog appendRejectedFromSystem(UUID orderId, UUID sourceLogOrderId, String reason) {
        List<OrderLog> orderLogs = orderLogRepository.findByOrderIdNewestFirstForUpdate(orderId);
        if (orderLogs.isEmpty()) {
            throw new OrderLogNotFoundException(orderId);
        }

        OrderLog latestOrderLog = orderLogs.get(0);
        if (latestOrderLog.getStatus() == OrderStatus.REJECTED) {
            return latestOrderLog;
        }
        if (latestOrderLog.getStatus() == OrderStatus.CANCELLED) {
            return latestOrderLog;
        }
        if (latestOrderLog.getStatus() != OrderStatus.SUBMITTED && latestOrderLog.getStatus() != OrderStatus.PENDING) {
            throw new InvalidTradeException(
                "Cannot mark REJECTED for order " + orderId + " while latest status is " + latestOrderLog.getStatus()
            );
        }

        OrderLog rejectedOrderLog = new OrderLog(
            latestOrderLog.getOrderId(),
            latestOrderLog.getPortfolio(),
            latestOrderLog.getInstrument(),
            latestOrderLog.getSide(),
            latestOrderLog.getQuantity()
        );
        rejectedOrderLog.setStatus(OrderStatus.REJECTED);

        String existingMetadata = latestOrderLog.getMetadata();
        String rejectionReason = reason == null || reason.isBlank() ? "Validation rejected" : reason;
        String rejectionMetadata = existingMetadata == null || existingMetadata.isBlank()
            ? "rejectionReason=" + rejectionReason
            : existingMetadata + " | rejectionReason=" + rejectionReason;
        rejectedOrderLog.setMetadata(rejectionMetadata);
        rejectedOrderLog.setExecutionPrice(latestOrderLog.getExecutionPrice());
        rejectedOrderLog.setQuotedPrice(latestOrderLog.getQuotedPrice());

        return orderLogRepository.save(rejectedOrderLog);
    }

    @Transactional
    public OrderLog getLatestOrderLogByOrderIdForUpdate(UUID orderId) {
        List<OrderLog> orderLogs = orderLogRepository.findByOrderIdNewestFirstForUpdate(orderId);
        if (orderLogs.isEmpty()) {
            throw new OrderLogNotFoundException(orderId);
        }

        return orderLogs.get(0);
    }

    @Transactional
    public OrderLog appendExecutedFromSystem(UUID orderId, UUID sourceLogOrderId, Double executionPriceUsed) {
        OrderLog latestOrderLog = getLatestOrderLogByOrderIdForUpdate(orderId);

        if (latestOrderLog.getStatus() == OrderStatus.EXECUTED) {
            return latestOrderLog;
        }

        if (latestOrderLog.getStatus() == OrderStatus.FAILED) {
            return latestOrderLog;
        }

        if (latestOrderLog.getStatus() != OrderStatus.ACCEPTED) {
            throw new InvalidTradeException(
                "Cannot append EXECUTED for order " + orderId
                    + " while latest status is " + latestOrderLog.getStatus()
                    + "; latest status must be ACCEPTED"
            );
        }

        OrderLog executedOrderLog = new OrderLog(
            latestOrderLog.getOrderId(),
            latestOrderLog.getPortfolio(),
            latestOrderLog.getInstrument(),
            latestOrderLog.getSide(),
            latestOrderLog.getQuantity()
        );
        executedOrderLog.setStatus(OrderStatus.EXECUTED);
        executedOrderLog.setMetadata(latestOrderLog.getMetadata());
        executedOrderLog.setExecutionPrice(
            executionPriceUsed != null ? executionPriceUsed : latestOrderLog.getExecutionPrice()
        );
        executedOrderLog.setQuotedPrice(latestOrderLog.getQuotedPrice());

        return orderLogRepository.save(executedOrderLog);
    }

    @Transactional
    public OrderLog appendFailedFromSystem(
        UUID orderId,
        UUID sourceLogOrderId,
        String failureReason,
        Double executionPriceUsed
    ) {
        OrderLog latestOrderLog = getLatestOrderLogByOrderIdForUpdate(orderId);

        if (latestOrderLog.getStatus() == OrderStatus.FAILED) {
            return latestOrderLog;
        }

        if (latestOrderLog.getStatus() == OrderStatus.EXECUTED) {
            return latestOrderLog;
        }

        if (latestOrderLog.getStatus() != OrderStatus.ACCEPTED) {
            throw new InvalidTradeException(
                "Cannot append FAILED for order " + orderId
                    + " while latest status is " + latestOrderLog.getStatus()
                    + "; latest status must be ACCEPTED"
            );
        }

        OrderLog failedOrderLog = new OrderLog(
            latestOrderLog.getOrderId(),
            latestOrderLog.getPortfolio(),
            latestOrderLog.getInstrument(),
            latestOrderLog.getSide(),
            latestOrderLog.getQuantity()
        );
        failedOrderLog.setStatus(OrderStatus.FAILED);

        String normalizedFailureReason =
            failureReason == null || failureReason.isBlank() ? "Unknown execution failure" : failureReason;
        String existingMetadata = latestOrderLog.getMetadata();
        String failureMetadata = existingMetadata == null || existingMetadata.isBlank()
            ? "failureReason=" + normalizedFailureReason
            : existingMetadata + " | failureReason=" + normalizedFailureReason;
        failedOrderLog.setMetadata(failureMetadata);

        failedOrderLog.setExecutionPrice(
            executionPriceUsed != null ? executionPriceUsed : latestOrderLog.getExecutionPrice()
        );
        failedOrderLog.setQuotedPrice(latestOrderLog.getQuotedPrice());

        return orderLogRepository.save(failedOrderLog);
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
        cancelledOrderLog.setQuotedPrice(latestOrderLog.getQuotedPrice());

        return orderLogRepository.save(cancelledOrderLog);
    }
}
