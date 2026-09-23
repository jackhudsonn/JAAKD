package com.example.backend.service;

import com.example.backend.dto.CreateOrderLogRequest;
import com.example.backend.model.Instrument;
import com.example.backend.model.OrderLog;
import com.example.backend.model.OrderStatus;
import com.example.backend.model.Portfolio;
import com.example.backend.repository.InstrumentRepository;
import com.example.backend.repository.OrderLogRepository;
import com.example.backend.repository.PortfolioRepository;
import com.example.backend.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        return orderLogRepository.findByPortfolioPortfolioIdAndPortfolioProfileUserIdOrderByTimestampDesc(portfolioId, userId);
    }

    public OrderLog getOrderLogById(UUID logOrderId) {
        UUID userId = currentUserService.getUserId();

        Optional<OrderLog> maybeOrderLog = orderLogRepository.findByLogOrderIDAndPortfolioProfileUserId(logOrderId, userId);
        if (maybeOrderLog.isEmpty()) {
            throw new IllegalArgumentException("Order log not found for id: " + logOrderId);
        }

        return maybeOrderLog.get();
    }

    @Transactional
    public OrderLog createOrderLog(CreateOrderLogRequest request) {
        // 1. Resolve current user
        UUID userId = currentUserService.getUserId();

        // 2. Ensure portfolio exists and belongs to user
        Optional<Portfolio> maybePortfolio = portfolioRepository.findByPortfolioIdAndProfileUserId(request.portfolioId(), userId);
        if (maybePortfolio.isEmpty()) {
            throw new IllegalArgumentException("Portfolio not found for id: " + request.portfolioId());
        }
        Portfolio portfolio = maybePortfolio.get();

        // 3. Ensure instrument exists
        Optional<Instrument> maybeInstrument = instrumentRepository.findById(request.instrumentId());
        if (maybeInstrument.isEmpty()) {
            throw new IllegalArgumentException("Instrument not found for id: " + request.instrumentId());
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
