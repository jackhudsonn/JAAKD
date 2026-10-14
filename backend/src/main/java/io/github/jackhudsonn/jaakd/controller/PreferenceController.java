package io.github.jackhudsonn.jaakd.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.jackhudsonn.jaakd.dto.PreferencesResponse;
import io.github.jackhudsonn.jaakd.dto.UpdatePreferencesRequest;
import io.github.jackhudsonn.jaakd.model.Preference;
import io.github.jackhudsonn.jaakd.service.PreferenceService;

import java.util.UUID;

@RestController
@RequestMapping("/api/preferences")
public class PreferenceController {

    private final PreferenceService preferenceService;

    public PreferenceController(PreferenceService preferenceService) {
        this.preferenceService = preferenceService;
    }

    @GetMapping("/portfolio/{portfolioId}")
    @ResponseStatus(HttpStatus.OK)
    public PreferencesResponse getPreferencesByPortfolio(@PathVariable UUID portfolioId) {
        Preference preference = preferenceService.getByPortfolio(portfolioId);
        return toResponse(preference);
    }

    @PutMapping("/portfolio/{portfolioId}")
    @ResponseStatus(HttpStatus.OK)
    public PreferencesResponse updatePreferencesByPortfolio(
        @PathVariable UUID portfolioId,
        @Valid @RequestBody UpdatePreferencesRequest request
    ) {
        Preference updated = preferenceService.updateByPortfolio(portfolioId, request);
        return toResponse(updated);
    }

    private PreferencesResponse toResponse(Preference preference) {
        return new PreferencesResponse(
            preference.getPreferenceId(),
            preference.getPortfolio().getPortfolioId(),
            preference.getDashboardWidgets(),
            preference.getCreatedAt(),
            preference.getUpdatedAt()
        );
    }
}