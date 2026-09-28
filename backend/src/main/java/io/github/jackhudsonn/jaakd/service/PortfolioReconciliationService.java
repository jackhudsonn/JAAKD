package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.PortfolioReconciliationResponse;
import io.github.jackhudsonn.jaakd.dto.ReconciliationMismatchResponse;
import io.github.jackhudsonn.jaakd.exception.PortfolioNotFoundException;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class PortfolioReconciliationService {

    private final PortfolioRepository portfolioRepository;
    private final OrderLogRepository orderLogRepository;
    private final HoldingRepository holdingRepository;
    private final PrivilegedAccessService privilegedAccessService;

    public PortfolioReconciliationService(
        PortfolioRepository portfolioRepository,
        OrderLogRepository orderLogRepository,
        HoldingRepository holdingRepository,
        PrivilegedAccessService privilegedAccessService
    ) {
        this.portfolioRepository = portfolioRepository;
        this.orderLogRepository = orderLogRepository;
        this.holdingRepository = holdingRepository;
        this.privilegedAccessService = privilegedAccessService;
    }

    public PortfolioReconciliationResponse reconcilePortfolio(UUID portfolioId) {
        privilegedAccessService.ensureAdminOrAuditor();

        portfolioRepository.findById(portfolioId)
            .orElseThrow(() -> new PortfolioNotFoundException(portfolioId));

        List<OrderLog> executedLogs = orderLogRepository
            .findByPortfolioPortfolioIdAndStatusOrderByTimestampAsc(portfolioId, OrderStatus.EXECUTED);
        List<Holding> holdings = holdingRepository.findByPortfolioID(portfolioId);

        Map<UUID, ReplayState> replay = new HashMap<>();
        List<ReconciliationMismatchResponse> mismatches = new ArrayList<>();

        for (int i = 0; i < executedLogs.size(); i++) {
            OrderLog log = executedLogs.get(i);
            if (log.getStatus() != OrderStatus.EXECUTED) {
                continue;
            }

            UUID instrumentId = log.getInstrument().getInstrumentId();
            ReplayState state = replay.computeIfAbsent(instrumentId, k -> new ReplayState());

            BigDecimal quantity = BigDecimal.valueOf(log.getQuantity());
            BigDecimal executionPrice = BigDecimal.valueOf(log.getExecutionPrice());

            if (log.getSide() == OrderSide.BUY) {
                state.quantity = state.quantity.add(quantity);
                state.openLots.addLast(new ReplayLot(quantity, executionPrice));
                continue;
            }

            if (log.getSide() == OrderSide.SELL) {
                state.quantity = state.quantity.subtract(quantity);

                BigDecimal remaining = quantity;
                BigDecimal realized = BigDecimal.ZERO;

                while (remaining.compareTo(BigDecimal.ZERO) > 0 && !state.openLots.isEmpty()) {
                    ReplayLot lot = state.openLots.peekFirst();
                    BigDecimal matched = remaining.min(lot.remainingQuantity);
                    realized = realized.add(executionPrice.subtract(lot.unitCost).multiply(matched));

                    lot.remainingQuantity = lot.remainingQuantity.subtract(matched);
                    remaining = remaining.subtract(matched);

                    if (lot.remainingQuantity.compareTo(BigDecimal.ZERO) == 0) {
                        state.openLots.removeFirst();
                    }
                }

                state.realizedPnl = state.realizedPnl.add(realized);

                if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                    mismatches.add(new ReconciliationMismatchResponse(
                        instrumentId,
                        null,
                        null,
                        null,
                        null,
                        "Replay found SELL quantity exceeding prior BUY lots for logOrderId=" + log.getLogOrderID()
                    ));
                }
                continue;
            }

            if (log.getSide() == OrderSide.DEPOSIT) {
                state.quantity = state.quantity.add(quantity);
                continue;
            }

            if (log.getSide() == OrderSide.WITHDRAW) {
                state.quantity = state.quantity.subtract(quantity);
            }
        }

        Map<UUID, Holding> holdingByInstrument = new HashMap<>();
        for (int i = 0; i < holdings.size(); i++) {
            Holding holding = holdings.get(i);
            holdingByInstrument.put(holding.getInstrumentID(), holding);
        }

        Set<UUID> allInstrumentIds = new HashSet<>();
        allInstrumentIds.addAll(replay.keySet());
        allInstrumentIds.addAll(holdingByInstrument.keySet());

        for (UUID instrumentId : allInstrumentIds) {
            ReplayState expectedState = replay.getOrDefault(instrumentId, new ReplayState());
            Holding actualHolding = holdingByInstrument.get(instrumentId);

            BigDecimal expectedQuantity = expectedState.quantity;
            BigDecimal expectedRealized = expectedState.realizedPnl;
            BigDecimal actualQuantity = actualHolding == null ? BigDecimal.ZERO : safe(actualHolding.getCurrentQuantity());
            BigDecimal actualRealized = actualHolding == null ? BigDecimal.ZERO : safe(actualHolding.getCumulativeRealizedPnl());

            if (expectedQuantity.compareTo(actualQuantity) != 0 || expectedRealized.compareTo(actualRealized) != 0) {
                String reason;
                if (actualHolding == null) {
                    reason = "Missing holding row for instrument with executed logs";
                } else if (!replay.containsKey(instrumentId)) {
                    reason = "Holding row exists without executed log replay state";
                } else {
                    reason = "Projected holding values differ from executed log replay";
                }

                mismatches.add(new ReconciliationMismatchResponse(
                    instrumentId,
                    expectedQuantity.doubleValue(),
                    actualQuantity.doubleValue(),
                    expectedRealized.doubleValue(),
                    actualRealized.doubleValue(),
                    reason
                ));
            }
        }

        return new PortfolioReconciliationResponse(
            portfolioId,
            executedLogs.size(),
            holdings.size(),
            mismatches.size(),
            !mismatches.isEmpty(),
            mismatches
        );
    }

    private BigDecimal safe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static final class ReplayState {
        private BigDecimal quantity = BigDecimal.ZERO;
        private BigDecimal realizedPnl = BigDecimal.ZERO;
        private Deque<ReplayLot> openLots = new ArrayDeque<>();
    }

    private static final class ReplayLot {
        private BigDecimal remainingQuantity;
        private final BigDecimal unitCost;

        private ReplayLot(BigDecimal remainingQuantity, BigDecimal unitCost) {
            this.remainingQuantity = remainingQuantity;
            this.unitCost = unitCost;
        }
    }
}
