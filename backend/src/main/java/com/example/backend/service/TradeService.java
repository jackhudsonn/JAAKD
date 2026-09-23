package com.example.backend.service;

import com.example.backend.dto.CreateTradeRequest;
import com.example.backend.model.Holding;
import com.example.backend.model.OrderLog;
import com.example.backend.model.Trade;
import com.example.backend.repository.HoldingRepository;
import com.example.backend.repository.OrderLogRepository;
import com.example.backend.repository.TradeRepository;
import com.example.backend.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class TradeService {

    private final TradeRepository tradeRepository;
    private final HoldingRepository holdingRepository;
    private final OrderLogRepository orderLogRepository;
    private final CurrentUserService currentUserService;

    public TradeService(
            TradeRepository tradeRepository,
            HoldingRepository holdingRepository,
            OrderLogRepository orderLogRepository,
            CurrentUserService currentUserService
    ) {
        this.tradeRepository = tradeRepository;
        this.holdingRepository = holdingRepository;
        this.orderLogRepository = orderLogRepository;
        this.currentUserService = currentUserService;
    }

    public List<Trade> getTradesForHolding(UUID holdingId) {
        UUID userId = currentUserService.getUserId();
        return tradeRepository.findByHoldingHoldingIdAndHoldingPortfolioProfileUserId(holdingId, userId);
    }

    public Trade getTradeById(UUID tradeId) {
        UUID userId = currentUserService.getUserId();

        Optional<Trade> maybeTrade = tradeRepository.findByTradeIDAndHoldingPortfolioProfileUserId(tradeId, userId);
        if (maybeTrade.isEmpty()) {
            throw new IllegalArgumentException("Trade not found for id: " + tradeId);
        }

        return maybeTrade.get();
    }

    @Transactional
    public Trade createTrade(CreateTradeRequest request) {
        // 1. Resolve current user
        UUID userId = currentUserService.getUserId();

        // 2. Ensure order log exists and belongs to user
        Optional<OrderLog> maybeOrderLog = orderLogRepository.findByLogOrderIDAndPortfolioProfileUserId(request.orderLogId(), userId);
        if (maybeOrderLog.isEmpty()) {
            throw new IllegalArgumentException("Order log not found for id: " + request.orderLogId());
        }
        OrderLog orderLog = maybeOrderLog.get();

        // 3. Resolve holding: use request.holdingId when provided; otherwise find/create by portfolio+instrument
        Holding holding;

        if (request.holdingId() != null) {
            Optional<Holding> maybeHolding = holdingRepository.findByHoldingIdAndPortfolioProfileUserId(request.holdingId(), userId);
            if (maybeHolding.isEmpty()) {
                throw new IllegalArgumentException("Holding not found for id: " + request.holdingId());
            }
            holding = maybeHolding.get();
        } else {
            UUID portfolioId = orderLog.getPortfolio().getPortfolioId();
            UUID instrumentId = orderLog.getInstrument().getInstrumentId();

            Optional<Holding> maybeHolding = holdingRepository
                    .findOwnedByPortfolioAndInstrument(
                            portfolioId,
                            instrumentId,
                            userId
                    );

            if (maybeHolding.isPresent()) {
                holding = maybeHolding.get();
            } else {
                // Create a new holding when this portfolio+instrument does not exist yet.
                Holding newHolding = new Holding(
                        orderLog.getPortfolio(),
                        orderLog.getInstrument(),
                        orderLog.getQuantity()
                );
                holding = holdingRepository.save(newHolding);
            }
        }

        // 4. Ensure holding and order log are from same portfolio and instrument
        UUID holdingPortfolioId = holding.getPortfolio().getPortfolioId();
        UUID orderLogPortfolioId = orderLog.getPortfolio().getPortfolioId();
        if (!holdingPortfolioId.equals(orderLogPortfolioId)) {
            throw new IllegalArgumentException("Holding and order log must belong to the same portfolio");
        }

        UUID holdingInstrumentId = holding.getInstrument().getInstrumentId();
        UUID orderLogInstrumentId = orderLog.getInstrument().getInstrumentId();
        if (!holdingInstrumentId.equals(orderLogInstrumentId)) {
            throw new IllegalArgumentException("Holding and order log must use the same instrument");
        }

        // 5. Prevent duplicate trade for same order log
        Optional<Trade> maybeExistingTrade = tradeRepository.findByOrderLogLogOrderID(orderLog.getLogOrderID());
        if (maybeExistingTrade.isPresent()) {
            throw new IllegalArgumentException("Trade already exists for order log: " + orderLog.getLogOrderID());
        }

        // 6. Build and persist trade
        Trade trade = new Trade(holding, orderLog);
        return tradeRepository.save(trade);
    }
}
