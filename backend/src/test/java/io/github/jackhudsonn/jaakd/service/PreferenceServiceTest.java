package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.UpdatePreferencesRequest;
import io.github.jackhudsonn.jaakd.exception.PortfolioNotFoundException;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.Preference;
import io.github.jackhudsonn.jaakd.model.Profile;
import io.github.jackhudsonn.jaakd.repository.PreferenceRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PreferenceServiceTest {

    @Mock
    private PreferenceRepository preferenceRepository;

    @Mock
    private PortfolioService portfolioService;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private PreferenceService preferenceService;

    @Test
    void getByPortfolio_notOwned_throwsNotFound() {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioService.getCurrentUserPortfolioById(portfolioId))
            .thenThrow(new PortfolioNotFoundException(portfolioId));

        assertThrows(PortfolioNotFoundException.class, () -> preferenceService.getByPortfolio(portfolioId));
        verify(preferenceRepository, never()).save(any(Preference.class));
    }

    @Test
    void getByPortfolio_createsDefaultWhenMissing() {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        Portfolio portfolio = new Portfolio(new Profile(userId, BigDecimal.ZERO));

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioService.getCurrentUserPortfolioById(portfolioId)).thenReturn(portfolio);
        when(preferenceRepository.findOwnedByPortfolioId(portfolioId, userId)).thenReturn(Optional.empty());
        when(preferenceRepository.save(any(Preference.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Preference preference = preferenceService.getByPortfolio(portfolioId);

        assertEquals(List.of("performance-graph", "watchlist", "portfolio-value", "allocation-by-asset"), preference.getDashboardWidgets());
        verify(preferenceRepository).save(any(Preference.class));
    }

    @Test
    void getByPortfolio_sanitizesCorruptedStoredWidgets() {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        Portfolio portfolio = new Portfolio(new Profile(userId, BigDecimal.ZERO));
        Preference existing = new Preference(portfolio, List.of("1", "3", "3", "5", "2", "bad-widget"));

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioService.getCurrentUserPortfolioById(portfolioId)).thenReturn(portfolio);
        when(preferenceRepository.findOwnedByPortfolioId(portfolioId, userId)).thenReturn(Optional.of(existing));
        when(preferenceRepository.save(existing)).thenReturn(existing);

        Preference preference = preferenceService.getByPortfolio(portfolioId);

        assertEquals(List.of("performance-graph", "watchlist"), preference.getDashboardWidgets());
        verify(preferenceRepository).save(existing);
    }

    @Test
    void updateByPortfolio_sanitizesIncomingWidgets() {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        Portfolio portfolio = new Portfolio(new Profile(userId, BigDecimal.ZERO));
        Preference existing = new Preference(portfolio, List.of("watchlist", "portfolio-value"));

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioService.getCurrentUserPortfolioById(portfolioId)).thenReturn(portfolio);
        when(preferenceRepository.findOwnedByPortfolioId(portfolioId, userId)).thenReturn(Optional.of(existing));
        when(preferenceRepository.save(existing)).thenReturn(existing);

        Preference updated = preferenceService.updateByPortfolio(
            portfolioId,
            new UpdatePreferencesRequest(List.of("portfolio-value", "portfolio-value", "watchlist", "not-a-widget"))
        );

        assertEquals(List.of("portfolio-value", "watchlist"), updated.getDashboardWidgets());
        verify(preferenceRepository).save(existing);
    }

    @Test
    void updateByPortfolio_unchangedWidgets_skipsSave() {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        Portfolio portfolio = new Portfolio(new Profile(userId, BigDecimal.ZERO));
        Preference existing = new Preference(portfolio, List.of("watchlist", "portfolio-value"));

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioService.getCurrentUserPortfolioById(portfolioId)).thenReturn(portfolio);
        when(preferenceRepository.findOwnedByPortfolioId(portfolioId, userId)).thenReturn(Optional.of(existing));

        Preference updated = preferenceService.updateByPortfolio(
            portfolioId,
            new UpdatePreferencesRequest(List.of("watchlist", "portfolio-value"))
        );

        assertEquals(List.of("watchlist", "portfolio-value"), updated.getDashboardWidgets());
        verify(preferenceRepository, never()).save(eq(existing));
    }
}
