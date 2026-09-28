package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.PortfolioNotEmptyException;
import io.github.jackhudsonn.jaakd.exception.PortfolioNotFoundException;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.Profile;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import io.github.jackhudsonn.jaakd.repository.ProfileRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PortfolioServiceTest {

    @Mock
    private PortfolioRepository portfolioRepository;

    @Mock
    private ProfileRepository profileRepository;

    @Mock
    private OrderLogRepository orderLogRepository;

    @Mock
    private HoldingRepository holdingRepository;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private PortfolioService portfolioService;

    @Test
    void deletePortfolio_notFound_throwsAndSkipsDeleteGuards() {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findOwnedByPortfolioId(portfolioId, userId)).thenReturn(Optional.empty());

        assertThrows(PortfolioNotFoundException.class, () -> portfolioService.deletePortfolio(portfolioId));

        verify(orderLogRepository, never()).existsOwnedActiveOrders(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyCollection()
        );
        verify(holdingRepository, never()).existsOwnedPositiveQuantityHolding(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any()
        );
        verify(portfolioRepository, never()).delete(org.mockito.ArgumentMatchers.any(Portfolio.class));
    }

    @Test
    void deletePortfolio_activeOrdersPresent_throwsConflictAndSkipsDelete() {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        Portfolio portfolio = new Portfolio(new Profile("owner@test.com", BigDecimal.ZERO));

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findOwnedByPortfolioId(portfolioId, userId)).thenReturn(Optional.of(portfolio));
        when(orderLogRepository.existsOwnedActiveOrders(
            org.mockito.ArgumentMatchers.eq(portfolioId),
            org.mockito.ArgumentMatchers.eq(userId),
            org.mockito.ArgumentMatchers.anyCollection()
        )).thenReturn(true);
        when(holdingRepository.existsOwnedPositiveQuantityHolding(portfolioId, userId)).thenReturn(false);

        PortfolioNotEmptyException ex = assertThrows(
            PortfolioNotEmptyException.class,
            () -> portfolioService.deletePortfolio(portfolioId)
        );

        assertTrue(ex.hasActiveOrders());
        assertFalse(ex.hasNonZeroHoldings());
        verify(portfolioRepository, never()).delete(portfolio);
    }

    @Test
    void deletePortfolio_nonZeroHoldingsPresent_throwsConflictAndSkipsDelete() {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        Portfolio portfolio = new Portfolio(new Profile("owner@test.com", BigDecimal.ZERO));

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findOwnedByPortfolioId(portfolioId, userId)).thenReturn(Optional.of(portfolio));
        when(orderLogRepository.existsOwnedActiveOrders(
            org.mockito.ArgumentMatchers.eq(portfolioId),
            org.mockito.ArgumentMatchers.eq(userId),
            org.mockito.ArgumentMatchers.anyCollection()
        )).thenReturn(false);
        when(holdingRepository.existsOwnedPositiveQuantityHolding(portfolioId, userId)).thenReturn(true);

        PortfolioNotEmptyException ex = assertThrows(
            PortfolioNotEmptyException.class,
            () -> portfolioService.deletePortfolio(portfolioId)
        );

        assertFalse(ex.hasActiveOrders());
        assertTrue(ex.hasNonZeroHoldings());
        verify(portfolioRepository, never()).delete(portfolio);
    }

    @Test
    void deletePortfolio_bothGuardsPresent_throwsConflictWithBothFlags() {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        Portfolio portfolio = new Portfolio(new Profile("owner@test.com", BigDecimal.ZERO));

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findOwnedByPortfolioId(portfolioId, userId)).thenReturn(Optional.of(portfolio));
        when(orderLogRepository.existsOwnedActiveOrders(
            org.mockito.ArgumentMatchers.eq(portfolioId),
            org.mockito.ArgumentMatchers.eq(userId),
            org.mockito.ArgumentMatchers.anyCollection()
        )).thenReturn(true);
        when(holdingRepository.existsOwnedPositiveQuantityHolding(portfolioId, userId)).thenReturn(true);

        PortfolioNotEmptyException ex = assertThrows(
            PortfolioNotEmptyException.class,
            () -> portfolioService.deletePortfolio(portfolioId)
        );

        assertTrue(ex.hasActiveOrders());
        assertTrue(ex.hasNonZeroHoldings());
        verify(portfolioRepository, never()).delete(portfolio);
    }

    @Test
    void deletePortfolio_noGuardsPresent_deletesPortfolioAndUsesExpectedStatuses() {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        Portfolio portfolio = new Portfolio(new Profile("owner@test.com", BigDecimal.ZERO));

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findOwnedByPortfolioId(portfolioId, userId)).thenReturn(Optional.of(portfolio));
        when(orderLogRepository.existsOwnedActiveOrders(
            org.mockito.ArgumentMatchers.eq(portfolioId),
            org.mockito.ArgumentMatchers.eq(userId),
            org.mockito.ArgumentMatchers.anyCollection()
        )).thenReturn(false);
        when(holdingRepository.existsOwnedPositiveQuantityHolding(portfolioId, userId)).thenReturn(false);

        portfolioService.deletePortfolio(portfolioId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<OrderStatus>> statusesCaptor = ArgumentCaptor.forClass(Collection.class);
        verify(orderLogRepository, times(1)).existsOwnedActiveOrders(
            org.mockito.ArgumentMatchers.eq(portfolioId),
            org.mockito.ArgumentMatchers.eq(userId),
            statusesCaptor.capture()
        );
        verify(holdingRepository, times(1)).existsOwnedPositiveQuantityHolding(portfolioId, userId);
        verify(portfolioRepository, times(1)).delete(portfolio);

        assertIterableEquals(
            java.util.List.of(OrderStatus.SUBMITTED, OrderStatus.PENDING, OrderStatus.ACCEPTED),
            statusesCaptor.getValue()
        );
    }
}
