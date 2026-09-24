package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderLogRepository extends JpaRepository<OrderLog, UUID> {
    List<OrderLog> findByOrderIDOrderByTimestampAsc(UUID orderId);

    List<OrderLog> findByPortfolioPortfolioId(UUID portfolioId);

    List<OrderLog> findByPortfolioPortfolioIdAndStatus(UUID portfolioId, OrderStatus status);

    List<OrderLog> findByInstrumentInstrumentId(UUID instrumentId);

        @Query("SELECT o FROM OrderLog o WHERE o.logOrderID = :logOrderId AND o.portfolio.profile.userId = :userId")
        Optional<OrderLog> findOwnedByLogOrderId(
            @Param("logOrderId") UUID logOrderId,
            @Param("userId") UUID userId
        );

        @Query("""
            SELECT o
            FROM OrderLog o
            WHERE o.portfolio.portfolioId = :portfolioId
                AND o.portfolio.profile.userId = :userId
            ORDER BY o.timestamp DESC
            """)
        List<OrderLog> findOwnedByPortfolioNewestFirst(
            @Param("portfolioId") UUID portfolioId,
            @Param("userId") UUID userId
        );
}
