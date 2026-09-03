package com.example.backend.service;

import org.springframework.stereotype.Service;

import com.example.backend.dto.TransactionDtos;
import com.example.backend.model.TransactionOrder;
import com.example.backend.model.TransactionLog;
import com.example.backend.model.Portfolio;
import com.example.backend.repository.TransactionOrderRepository;
import com.example.backend.repository.TransactionLogRepository;
import com.example.backend.repository.PortfolioRepository;
import com.example.backend.security.CurrentUserService;

import java.time.Instant;
import java.util.UUID;

@Service
public class TransactionService {

    private final TransactionOrderRepository transactionOrderRepository;
    private final TransactionLogRepository transactionLogRepository;
    private final PortfolioRepository portfolioRepository;
    private final CurrentUserService currentUserService;

    public TransactionService(
            TransactionOrderRepository transactionOrderRepository,
            TransactionLogRepository transactionLogRepository,
            PortfolioRepository portfolioRepository,
            CurrentUserService currentUserService) {
        this.transactionOrderRepository = transactionOrderRepository;
        this.transactionLogRepository = transactionLogRepository;
        this.portfolioRepository = portfolioRepository;
        this.currentUserService = currentUserService;
    }

    // ==================== STEP 1: PLACE ====================
    public String placeTransaction(TransactionDtos transaction) {
        // 1. Extract current user
        UUID userId = currentUserService.getUserId();
        
        // 2. Validate portfolio ownership
        UUID portfolioId = transaction.portfolioId();
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found"));
        if (!portfolio.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Portfolio does not belong to current user");
        }
        
    
        // 4. Parse order details (type/format already validated by PlaceOrderRequest)
        Long amount = transaction.amount();
        String side = transaction.side();
        String currency = transaction.currency();
        
        // 5. Validate business rules (defense in depth alongside PlaceOrderRequest's bean validation)
        if (amount <= 0) throw new IllegalArgumentException("Amount must be positive");
        if (!side.equalsIgnoreCase("deposite") && !side.equalsIgnoreCase("withdraw")) {
            throw new IllegalArgumentException("Side must be 'deposite' or 'withdraw'");
        }
        
        // 6. For BUY: check sufficient cash available
        if (side.equalsIgnoreCase("withdraw")) {
            if (portfolio.getCashHoldings() < amount) {
                throw new IllegalArgumentException("Insufficient cash");
            }
        }
        
        // 6. For SELL: check sufficient stock quantity
        if (side.equalsIgnoreCase("deposite")) {
            if (1 > amount) {
                throw new IllegalArgumentException("Insufficient deposite amount");
            }
        }
        
        // 8. Create TransactionOrder
        TransactionOrder transactionOrder = new TransactionOrder(portfolioId, amount, currency, side);
        TransactionOrder savedTransaction = transactionOrderRepository.save(transactionOrder);
        
        // 9. Create TransactionLog with "Placed"
        TransactionLog transactionLog = new TransactionLog(savedTransaction.getTransactionId());
        transactionLog.setTStatus("Placed");
        transactionLogRepository.save(transactionLog);
        
        return "Transaction placed: " + savedTransaction.getTransactionId();
    }

    // ==================== STEP 2: ACCEPT ====================
    public String acceptTransaction(UUID transactionId) {
        // 1. Find existing TransactionOrder
        TransactionOrder transaction = transactionOrderRepository.findById(transactionId)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));
        
        Portfolio portfolio = portfolioRepository.findById(transaction.getPortfolioId())
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found"));
    
        // TODO: check bank connection and credentials
        
        // 5. Create TransactionLog with "Accepted"
        TransactionLog acceptLog = new TransactionLog(transactionId);
        acceptLog.setTStatus("Accepted");
        transactionLogRepository.save(acceptLog);
        
        return "Transaction accepted: " + transactionId;
    }

    // ==================== STEP 3: EXECUTE ====================
    public String executeTransaction(UUID transactionId, Double executionPrice) {
        // 1. Find existing TransactionOrder
        TransactionOrder transaction = transactionOrderRepository.findById(transactionId)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));
        
        Portfolio portfolio = portfolioRepository.findById(transaction.getPortfolioId())
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found"));
        
        Long amount = transaction.getAmount();
        String side = transaction.getSide();
        
        // 2. Validate sufficient balance based on transaction side
        if (side.equalsIgnoreCase("withdraw")) {
            // Recheck current cash holdings
            if (portfolio.getCashHoldings() < amount) {
                throw new IllegalArgumentException("Insufficient cash at execution time");
            }
            
            // Deduct transaction amount
            portfolio.setCashHoldings(portfolio.getCashHoldings() - amount);
            portfolioRepository.save(portfolio);
        }
        
        // 3. For deposit transactions
        if (side.equalsIgnoreCase("deposite")) {
            // Add transaction amount
            portfolio.setCashHoldings(portfolio.getCashHoldings() + amount);
            portfolioRepository.save(portfolio);
        }
        
        // 4. Create TransactionLog with "Executed"
        TransactionLog execLog = new TransactionLog(transactionId);
        execLog.setTStatus("Executed");
        transactionLogRepository.save(execLog);
        
        return "Transaction executed: " + transactionId;
    }

    // ==================== HELPER METHODS ====================
   
    public String ping() {
        return "ok - transaction service";
    }
}