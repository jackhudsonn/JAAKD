package com.example.backend.repository;

import com.example.backend.model.TradeOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TradeOrderRepository extends JpaRepository<TradeOrder, UUID> {

    List<TradeOrder> findByPortfolioId(UUID portfolioId);
}
