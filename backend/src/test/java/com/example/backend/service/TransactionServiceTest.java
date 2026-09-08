package com.example.backend.service;

import com.example.backend.dto.TransactionDtos;
import com.example.backend.model.Portfolio;
import com.example.backend.model.TransactionOrder;
import com.example.backend.model.TransactionLog;
import com.example.backend.repository.TransactionOrderRepository;
import com.example.backend.repository.TransactionLogRepository;
import com.example.backend.repository.PortfolioRepository;
import com.example.backend.security.CurrentUserService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @Mock
    private TransactionOrderRepository transactionOrderRepository;
    @Mock
    private TransactionLogRepository transactionLogRepository;
    @Mock
    private PortfolioRepository portfolioRepository;
    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private TransactionService transactionService;

    private UUID userId;
    private UUID portfolioId;
    private UUID transactionId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        portfolioId = UUID.randomUUID();
        transactionId = UUID.randomUUID();
    }

    // ==================== ping ====================

    @Test
    void ping_returnsExpectedMessage() {
        assertThat(transactionService.ping()).isEqualTo("ok - transaction service");
    }

    // ==================== placeTransaction - Deposit ====================

    @Test
    void placeTransaction_deposit_withValidInput_savesTransactionAndLogs() {
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(0.0);

        TransactionDtos depositTransaction = new TransactionDtos(
                portfolioId,
                1000L,
                "deposite",
                "USD"
        );

        TransactionOrder savedOrder = new TransactionOrder(portfolioId, 1000L, "USD", "deposite");

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(transactionOrderRepository.save(any(TransactionOrder.class))).thenReturn(savedOrder);

        String result = transactionService.placeTransaction(depositTransaction);

        assertThat(result).contains("Transaction placed:");
        verify(transactionOrderRepository).save(any(TransactionOrder.class));
        verify(transactionLogRepository).save(any(TransactionLog.class));
    }

    @Test
    void placeTransaction_deposit_withNegativeAmount_throws() {
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(0.0);

        TransactionDtos depositTransaction = new TransactionDtos(
                portfolioId,
                -1000L,
                "deposite",
                "USD"
        );

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));

        assertThatThrownBy(() -> transactionService.placeTransaction(depositTransaction))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Amount must be positive");
    }

    // ==================== placeTransaction - Withdraw ====================

    @Test
    void placeTransaction_withdraw_withSufficientFunds_savesTransactionAndLogs() {
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(5000.0);

        TransactionDtos withdrawTransaction = new TransactionDtos(
                portfolioId,
                2000L,
                "withdraw",
                "USD"
        );

        TransactionOrder savedOrder = new TransactionOrder(portfolioId, 2000L, "USD", "withdraw");

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(transactionOrderRepository.save(any(TransactionOrder.class))).thenReturn(savedOrder);

        String result = transactionService.placeTransaction(withdrawTransaction);

        assertThat(result).contains("Transaction placed:");
        verify(transactionOrderRepository).save(any(TransactionOrder.class));
        verify(transactionLogRepository).save(any(TransactionLog.class));
    }

    @Test
    void placeTransaction_withdraw_withInsufficientFunds_throws() {
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(500.0);

        TransactionDtos withdrawTransaction = new TransactionDtos(
                portfolioId,
                2000L,
                "withdraw",
                "USD"
        );

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));

        assertThatThrownBy(() -> transactionService.placeTransaction(withdrawTransaction))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Insufficient cash");
    }

    @Test
    void placeTransaction_withdraw_withZeroAmount_throws() {
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(5000.0);

        TransactionDtos withdrawTransaction = new TransactionDtos(
                portfolioId,
                0L,
                "withdraw",
                "USD"
        );

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));

        assertThatThrownBy(() -> transactionService.placeTransaction(withdrawTransaction))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Amount must be positive");
    }

    @Test
    void placeTransaction_portfolioNotFound_throws() {
        TransactionDtos transaction = new TransactionDtos(
                portfolioId,
                1000L,
                "deposite",
                "USD"
        );

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> transactionService.placeTransaction(transaction))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Portfolio not found");
    }

    @Test
    void placeTransaction_portfolioNotOwnedByUser_throws() {
        Portfolio portfolio = new Portfolio(UUID.randomUUID());
        portfolio.setCashHoldings(5000.0);

        TransactionDtos transaction = new TransactionDtos(
                portfolioId,
                1000L,
                "deposite",
                "USD"
        );

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));

        assertThatThrownBy(() -> transactionService.placeTransaction(transaction))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Portfolio does not belong to current user");
    }

    @Test
    void placeTransaction_invalidSide_throws() {
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(5000.0);

        TransactionDtos transaction = new TransactionDtos(
                portfolioId,
                1000L,
                "transfer",
                "USD"
        );

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));

        assertThatThrownBy(() -> transactionService.placeTransaction(transaction))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Side must be");
    }

    // ==================== acceptTransaction ====================

    @Test
    void acceptTransaction_withValidTransaction_logsAccepted() {
        TransactionOrder transaction = new TransactionOrder(portfolioId, 1000L, "USD", "deposite");
        Portfolio portfolio = new Portfolio(userId);

        when(transactionOrderRepository.findById(transactionId)).thenReturn(Optional.of(transaction));
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));

        String result = transactionService.acceptTransaction(transactionId);

        assertThat(result).contains("Transaction accepted:");
        verify(transactionLogRepository).save(any(TransactionLog.class));
    }

    @Test
    void acceptTransaction_withNonexistentTransaction_throws() {
        when(transactionOrderRepository.findById(transactionId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> transactionService.acceptTransaction(transactionId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Transaction not found");
    }

    // ==================== executeTransaction - Deposit ====================

    @Test
    void executeTransaction_deposit_addsAmountToPortfolio() {
        TransactionOrder transaction = new TransactionOrder(portfolioId, 1000L, "USD", "deposite");
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(5000.0);

        when(transactionOrderRepository.findById(transactionId)).thenReturn(Optional.of(transaction));
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(portfolioRepository.save(any(Portfolio.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String result = transactionService.executeTransaction(transactionId, null);

        assertThat(result).contains("Transaction executed:");
        
        // Verify portfolio cash was updated correctly
        ArgumentCaptor<Portfolio> portfolioCaptor = ArgumentCaptor.forClass(Portfolio.class);
        verify(portfolioRepository).save(portfolioCaptor.capture());
        Portfolio savedPortfolio = portfolioCaptor.getValue();
        assertThat(savedPortfolio.getCashHoldings()).isEqualTo(6000.0);
        
        verify(transactionLogRepository).save(any(TransactionLog.class));
    }

    // ==================== executeTransaction - Withdraw ====================

    @Test
    void executeTransaction_withdraw_deductsAmountFromPortfolio() {
        TransactionOrder transaction = new TransactionOrder(portfolioId, 2000L, "USD", "withdraw");
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(5000.0);

        when(transactionOrderRepository.findById(transactionId)).thenReturn(Optional.of(transaction));
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(portfolioRepository.save(any(Portfolio.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String result = transactionService.executeTransaction(transactionId, null);

        assertThat(result).contains("Transaction executed:");
        
        // Verify portfolio cash was updated correctly
        ArgumentCaptor<Portfolio> portfolioCaptor = ArgumentCaptor.forClass(Portfolio.class);
        verify(portfolioRepository).save(portfolioCaptor.capture());
        Portfolio savedPortfolio = portfolioCaptor.getValue();
        assertThat(savedPortfolio.getCashHoldings()).isEqualTo(3000.0);
        
        verify(transactionLogRepository).save(any(TransactionLog.class));
    }

    @Test
    void executeTransaction_withdraw_withInsufficientFunds_throws() {
        TransactionOrder transaction = new TransactionOrder(portfolioId, 6000L, "USD", "withdraw");
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(5000.0);

        when(transactionOrderRepository.findById(transactionId)).thenReturn(Optional.of(transaction));
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));

        assertThatThrownBy(() -> transactionService.executeTransaction(transactionId, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Insufficient cash at execution time");
    }

    @Test
    void executeTransaction_transactionNotFound_throws() {
        when(transactionOrderRepository.findById(transactionId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> transactionService.executeTransaction(transactionId, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Transaction not found");
    }
}
