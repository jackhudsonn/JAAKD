package com.example.backend.repository;

import com.example.backend.model.TransactionOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TransactionOrderRepository extends JpaRepository<TransactionOrder, UUID> {

    List<TransactionOrder> findByPortfolioId(UUID portfolioId);
}
