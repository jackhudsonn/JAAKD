package io.github.jackhudsonn.jaakd.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.jackhudsonn.jaakd.dto.CreateOrderLogRequest;
import io.github.jackhudsonn.jaakd.exception.InstrumentNotFoundException;
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

    public OrderLogService(
        OrderLogRepository orderLogRepository,
        PortfolioRepository portfolioRepository,
        InstrumentRepository instrumentRepository,
        CurrentUserService currentUserService
    ) {
        this.orderLogRepository = orderLogRepository;
        this.portfolioRepository = portfolioRepository;
        this.instrumentRepository = instrumentRepository;
        this.currentUserService = currentUserService;
    }

    public List<OrderLog> getOrderLogsForPortfolio(UUID portfolioId) {
        UUID userId = currentUserService.getUserId();
        
        return orderLogRepository.findOwnedByPortfolioNewestFirst(portfolioId, userId);
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
}
