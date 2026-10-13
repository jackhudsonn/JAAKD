package io.github.jackhudsonn.jaakd.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.jackhudsonn.jaakd.dto.UpdatePreferencesRequest;
import io.github.jackhudsonn.jaakd.exception.PortfolioNotFoundException;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.Preference;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import io.github.jackhudsonn.jaakd.repository.PreferenceRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class PreferenceService {

    private static final List<String> ALLOWED_WIDGET_IDS = List.of(
        "performance-graph",
        "watchlist",
        "portfolio-value",
        "allocation-by-asset",
        "open-orders",
        "top-movers",
        "to-be-deleted"
    );

    private static final List<String> DEFAULT_WIDGET_IDS = List.of(
        "performance-graph",
        "watchlist",
        "portfolio-value",
        "allocation-by-asset"
    );

    private static final int MIN_SELECTED_WIDGETS = 2;

    private final PreferenceRepository preferenceRepository;
    private final PortfolioRepository portfolioRepository;
    private final CurrentUserService currentUserService;

    public PreferenceService(
        PreferenceRepository preferenceRepository,
        PortfolioRepository portfolioRepository,
        CurrentUserService currentUserService
    ) {
        this.preferenceRepository = preferenceRepository;
        this.portfolioRepository = portfolioRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public Preference getByPortfolio(UUID portfolioId) {
        UUID userId = currentUserService.getUserId();
        Portfolio portfolio = portfolioRepository.findOwnedByPortfolioId(portfolioId, userId)
            .orElseThrow(() -> new PortfolioNotFoundException(portfolioId));

        Optional<Preference> maybeExisting = preferenceRepository.findOwnedByPortfolioId(portfolioId, userId);

        if (maybeExisting.isEmpty()) {
            Preference created = new Preference(portfolio, DEFAULT_WIDGET_IDS);
            return preferenceRepository.save(created);
        }

        Preference existing = maybeExisting.get();
        List<String> sanitized = sanitizeWidgetIds(existing.getDashboardWidgets());

        if (!sanitized.equals(existing.getDashboardWidgets())) {
            existing.setDashboardWidgets(sanitized);
            return preferenceRepository.save(existing);
        }

        return existing;
    }

    @Transactional
    public Preference updateByPortfolio(UUID portfolioId, UpdatePreferencesRequest request) {
        Preference preference = getByPortfolio(portfolioId);
        List<String> sanitized = sanitizeWidgetIds(request.dashboardWidgets());

        preference.setDashboardWidgets(sanitized);
        return preferenceRepository.save(preference);
    }

    private List<String> sanitizeWidgetIds(List<String> requested) {
        List<String> incoming = requested == null ? List.of() : requested;

        List<String> normalized = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (int i = 0; i < incoming.size(); i++) {
            String candidate = normalizeWidgetId(incoming.get(i));

            if (candidate == null || !ALLOWED_WIDGET_IDS.contains(candidate) || seen.contains(candidate)) {
                continue;
            }

            seen.add(candidate);
            normalized.add(candidate);
        }

        for (int i = 0; normalized.size() < MIN_SELECTED_WIDGETS && i < DEFAULT_WIDGET_IDS.size(); i++) {
            String fallback = DEFAULT_WIDGET_IDS.get(i);
            if (seen.add(fallback)) {
                normalized.add(fallback);
            }
        }

        if (normalized.isEmpty()) {
            return DEFAULT_WIDGET_IDS;
        }

        return normalized;
    }

    private String normalizeWidgetId(String raw) {
        if (raw == null) {
            return null;
        }

        String trimmed = raw.trim().toLowerCase();
        if (trimmed.isEmpty()) {
            return null;
        }

        if (trimmed.chars().allMatch(Character::isDigit)) {
            try {
                int oneBasedIndex = Integer.parseInt(trimmed);
                if (oneBasedIndex >= 1 && oneBasedIndex <= ALLOWED_WIDGET_IDS.size()) {
                    return ALLOWED_WIDGET_IDS.get(oneBasedIndex - 1);
                }
            } catch (NumberFormatException ignored) {
                return null;
            }
        }

        return trimmed;
    }
}