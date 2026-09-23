package com.example.backend.repository;

import com.example.backend.model.OrderLog;
import com.example.backend.model.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderLogRepository extends JpaRepository<OrderLog, UUID> {

    List<OrderLog> findByOrderIDOrderByTimestampAsc(UUID orderId);

    List<OrderLog> findByPortfolioPortfolioId(UUID portfolioId);

    List<OrderLog> findByPortfolioPortfolioIdAndStatus(UUID portfolioId, OrderStatus status);

    List<OrderLog> findByInstrumentInstrumentId(UUID instrumentId);

    Optional<OrderLog> findByLogOrderIDAndPortfolioProfileUserId(UUID logOrderId, UUID userId);

    List<OrderLog> findByPortfolioPortfolioIdAndPortfolioProfileUserIdOrderByTimestampDesc(UUID portfolioId, UUID userId);
}
