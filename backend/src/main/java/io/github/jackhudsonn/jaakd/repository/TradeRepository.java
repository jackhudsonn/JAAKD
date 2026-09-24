package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.jackhudsonn.jaakd.model.Trade;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TradeRepository extends JpaRepository<Trade, UUID> {

    List<Trade> findByHoldingHoldingId(UUID holdingId);

    Optional<Trade> findByOrderLogLogOrderID(UUID orderLogId);

    @Query("""
            SELECT t FROM Trade t
            WHERE t.tradeID = :tradeId
              AND t.holding.portfolio.profile.userId = :userId
            """)
    Optional<Trade> findOwnedByTradeId(
            @Param("tradeId") UUID tradeId,
            @Param("userId") UUID userId
    );

    @Query("""
            SELECT t FROM Trade t
            WHERE t.holding.holdingId = :holdingId
              AND t.holding.portfolio.profile.userId = :userId
            """)
    List<Trade> findOwnedByHoldingId(
            @Param("holdingId") UUID holdingId,
            @Param("userId") UUID userId
    );
}
