package io.github.jackhudsonn.jaakd.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.github.jackhudsonn.jaakd.config.SecurityConfig;
import io.github.jackhudsonn.jaakd.dto.AuditPageResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.ClassValuePoint;
import io.github.jackhudsonn.jaakd.dto.analytics.InstrumentPerformanceResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.PortfolioValuePoint;
import io.github.jackhudsonn.jaakd.dto.analytics.SegmentClassExposure;
import io.github.jackhudsonn.jaakd.dto.analytics.SegmentSummaryResponse;
import io.github.jackhudsonn.jaakd.exception.AnalyticsNotFoundException;
import io.github.jackhudsonn.jaakd.exception.AnalyticsUnavailableException;
import io.github.jackhudsonn.jaakd.exception.ForbiddenException;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.security.AuthenticatedUser;
import io.github.jackhudsonn.jaakd.security.SessionAuthenticationFilter;
import io.github.jackhudsonn.jaakd.service.AnalyticsService;
import io.github.jackhudsonn.jaakd.service.SessionService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AnalyticsController.class)
@Import({ SecurityConfig.class, AnalyticsControllerContractTest.TestBeans.class })
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class AnalyticsControllerContractTest {

    private static final UUID SESSION_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AnalyticsService analyticsService;

    @Autowired
    private SessionService sessionService;

    @BeforeEach
    void setUp() {
        reset(analyticsService);
        when(sessionService.resolve(SESSION_ID))
            .thenReturn(Optional.of(new AuthenticatedUser(USER_ID, "analyst@example.com")));
    }

    @Test
    void listInstruments_bindsFiltersAndReturnsPagedEnvelope() throws Exception {
        UUID instrumentId = UUID.randomUUID();
        InstrumentPerformanceResponse aapl = new InstrumentPerformanceResponse(
            instrumentId, "AAPL", "Apple Inc.", "NASDAQ", "EQUITY", "USD",
            new BigDecimal("343.46"), new BigDecimal("0.01"), new BigDecimal("0.05"), new BigDecimal("0.12"),
            new BigDecimal("0.20"), new BigDecimal("0.25"), new BigDecimal("-0.10"),
            3, new BigDecimal("30000"), new BigDecimal("1500")
        );

        when(analyticsService.listInstruments(InstrumentClass.EQUITY, "app", "USA", "25-34", "return1m", "asc", 0, 10))
            .thenReturn(new AuditPageResponse<>(List.of(aapl), 0, 10, 1, 1, false));

        mockMvc.perform(get("/api/analytics/instruments")
                .cookie(authCookie())
                .queryParam("instrumentClass", "EQUITY")
                .queryParam("search", "app")
                .queryParam("country", "USA")
                .queryParam("ageBand", "25-34")
                .queryParam("sort", "return1m")
                .queryParam("direction", "asc")
                .queryParam("page", "0")
                .queryParam("size", "10")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].instrumentId").value(instrumentId.toString()))
            .andExpect(jsonPath("$.content[0].return1m").value(0.05))
            .andExpect(jsonPath("$.content[0].netFlow30dUsd").value(1500))
            .andExpect(jsonPath("$.totalElements").value(1));

        verify(analyticsService).listInstruments(InstrumentClass.EQUITY, "app", "USA", "25-34", "return1m", "asc", 0, 10);
    }

    @Test
    void getPortfolioClassSeries_requiresAClass() throws Exception {
        UUID portfolioId = UUID.randomUUID();

        mockMvc.perform(get("/api/analytics/portfolios/{portfolioId}/class-series", portfolioId)
                .cookie(authCookie())
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest());

        when(analyticsService.getPortfolioClassSeries(portfolioId, InstrumentClass.EQUITY, null, null))
            .thenReturn(List.of(new ClassValuePoint(LocalDate.of(2026, 10, 16), new BigDecimal("3000"),
                new BigDecimal("3434.6"), new BigDecimal("120"), new BigDecimal("434.6"))));

        mockMvc.perform(get("/api/analytics/portfolios/{portfolioId}/class-series", portfolioId)
                .cookie(authCookie())
                .queryParam("instrumentClass", "EQUITY")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].marketValueUsd").value(3434.6));
    }

    @Test
    void getSegments_bindsDimension() throws Exception {
        when(analyticsService.getSegments("country")).thenReturn(List.of(
            new SegmentSummaryResponse("USA", 2, new BigDecimal("9000"), new BigDecimal("0.05"),
                List.of(new SegmentClassExposure("EQUITY", new BigDecimal("6000"), 2)))
        ));

        mockMvc.perform(get("/api/analytics/segments")
                .cookie(authCookie())
                .queryParam("by", "country")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].segment").value("USA"))
            .andExpect(jsonPath("$[0].classes[0].instrumentClass").value("EQUITY"));
    }

    @Test
    void getPortfolioSeries_bindsDateRange() throws Exception {
        UUID portfolioId = UUID.randomUUID();
        LocalDate from = LocalDate.of(2026, 9, 1);
        LocalDate to = LocalDate.of(2026, 10, 16);

        when(analyticsService.getPortfolioSeries(portfolioId, from, to)).thenReturn(List.of(
            new PortfolioValuePoint(to, new BigDecimal("4500"), new BigDecimal("1000"), BigDecimal.ZERO,
                new BigDecimal("0.0227"), new BigDecimal("0.0227"))
        ));

        mockMvc.perform(get("/api/analytics/portfolios/{portfolioId}/series", portfolioId)
                .cookie(authCookie())
                .queryParam("from", "2026-09-01")
                .queryParam("to", "2026-10-16")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].date").value("2026-10-16"))
            .andExpect(jsonPath("$[0].cumulativeTwr").value(0.0227));

        verify(analyticsService).getPortfolioSeries(portfolioId, from, to);
    }

    @Test
    void unknownInstrumentClass_returnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/analytics/instruments")
                .cookie(authCookie())
                .queryParam("instrumentClass", "BONDS")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Invalid value 'BONDS' for parameter 'instrumentClass'"));
    }

    @Test
    void invalidSort_returnsBadRequest() throws Exception {
        when(analyticsService.listPortfolios(null, null, "nope", null, null, null))
            .thenThrow(new ValidationException("Sort must be one of: marketValue"));

        mockMvc.perform(get("/api/analytics/portfolios")
                .cookie(authCookie())
                .queryParam("sort", "nope")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Sort must be one of: marketValue"));
    }

    @Test
    void missingSession_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/analytics/meta").accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void nonAnalyst_returnsForbidden() throws Exception {
        when(analyticsService.getMeta()).thenThrow(new ForbiddenException("Admin or analyst user type is required"));

        mockMvc.perform(get("/api/analytics/meta")
                .cookie(authCookie())
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("Admin or analyst user type is required"));
    }

    @Test
    void unknownHolding_returnsNotFound() throws Exception {
        UUID holdingId = UUID.randomUUID();
        when(analyticsService.getHoldingSeries(holdingId, null, null))
            .thenThrow(new AnalyticsNotFoundException("holding", holdingId));

        mockMvc.perform(get("/api/analytics/holdings/{holdingId}/series", holdingId)
                .cookie(authCookie())
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("No analytics found for holding id: " + holdingId));
    }

    @Test
    void analyticsDown_returnsServiceUnavailable() throws Exception {
        when(analyticsService.getClassSummary(null, null)).thenThrow(new AnalyticsUnavailableException("Analytics is not enabled"));

        mockMvc.perform(get("/api/analytics/summary")
                .cookie(authCookie())
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.message").value("Analytics is not enabled"));
    }

    private Cookie authCookie() {
        return new Cookie(SessionAuthenticationFilter.SESSION_COOKIE, SESSION_ID.toString());
    }

    @TestConfiguration
    static class TestBeans {
        @Bean
        AnalyticsService analyticsService() {
            return mock(AnalyticsService.class);
        }

        @Bean
        SessionService sessionService() {
            return mock(SessionService.class);
        }

        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper().registerModule(new JavaTimeModule());
        }
    }
}
