package com.example.backend.repository;

import com.example.backend.model.OrderLog;
import com.example.backend.model.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OrderLogRepository extends JpaRepository<OrderLog, UUID> {

    List<OrderLog> findByOrderIdOrderByTimestampAsc(UUID orderId);

    List<OrderLog> findByPortfolioId(UUID portfolioId);

    List<OrderLog> findByPortfolioIdAndStatus(UUID portfolioId, OrderStatus status);

    List<OrderLog> findByInstrumentId(UUID instrumentId);
}
