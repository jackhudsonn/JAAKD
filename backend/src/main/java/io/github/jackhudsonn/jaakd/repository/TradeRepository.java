package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import io.github.jackhudsonn.jaakd.model.Trade;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TradeRepository extends JpaRepository<Trade, UUID> {

    List<Trade> findByHoldingHoldingId(UUID holdingId);

    Optional<Trade> findByOrderLogLogOrderID(UUID orderLogId);

    Optional<Trade> findByTradeIDAndHoldingPortfolioProfileUserId(UUID tradeId, UUID userId);

    List<Trade> findByHoldingHoldingIdAndHoldingPortfolioProfileUserId(UUID holdingId, UUID userId);
}
