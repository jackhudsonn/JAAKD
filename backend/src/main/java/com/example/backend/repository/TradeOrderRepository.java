package com.example.backend.repository;

import com.example.backend.model.OrderLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TradeOrderRepository extends JpaRepository<OrderLog, UUID> {

    List<OrderLog> findByPortfolioId(UUID portfolioId);
}
