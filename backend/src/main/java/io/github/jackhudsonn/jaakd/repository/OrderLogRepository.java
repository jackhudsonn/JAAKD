package io.github.jackhudsonn.jaakd.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
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

    List<OrderLog> findByPortfolioPortfolioIdOrderByTimestampDesc(UUID portfolioId);

    List<OrderLog> findByPortfolioPortfolioIdAndStatus(UUID portfolioId, OrderStatus status);

    List<OrderLog> findByPortfolioPortfolioIdAndStatusOrderByTimestampAsc(UUID portfolioId, OrderStatus status);

    List<OrderLog> findByInstrumentInstrumentId(UUID instrumentId);

        @Query("SELECT o FROM OrderLog o WHERE o.logOrderID = :logOrderId AND o.portfolio.profile.userId = :userId")
        Optional<OrderLog> findOwnedByLogOrderId(
            @Param("logOrderId") UUID logOrderId,
            @Param("userId") UUID userId
        );

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("SELECT o FROM OrderLog o WHERE o.logOrderID = :logOrderId AND o.portfolio.profile.userId = :userId")
        Optional<OrderLog> findOwnedByLogOrderIdForUpdate(
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

        @Query("""
            SELECT o
            FROM OrderLog o
            WHERE o.portfolio.portfolioId = :portfolioId
                AND o.portfolio.profile.userId = :userId
                AND o.status = :status
            ORDER BY o.timestamp ASC
            """)
        List<OrderLog> findOwnedExecutedByPortfolioOldestFirst(
            @Param("portfolioId") UUID portfolioId,
            @Param("userId") UUID userId,
            @Param("status") OrderStatus status
        );
}
