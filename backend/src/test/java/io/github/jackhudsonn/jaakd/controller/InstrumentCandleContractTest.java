package io.github.jackhudsonn.jaakd.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.github.jackhudsonn.jaakd.config.SecurityConfig;
import io.github.jackhudsonn.jaakd.dto.InstrumentCandleResponse;
import io.github.jackhudsonn.jaakd.security.AuthenticatedUser;
import io.github.jackhudsonn.jaakd.security.SessionAuthenticationFilter;
import io.github.jackhudsonn.jaakd.service.InstrumentService;
import io.github.jackhudsonn.jaakd.service.PriceHistoryService;
import io.github.jackhudsonn.jaakd.service.SessionService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
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

@WebMvcTest(controllers = InstrumentController.class)
@Import({ SecurityConfig.class, InstrumentCandleContractTest.TestBeans.class })
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class InstrumentCandleContractTest {

    private static final UUID SESSION_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID INSTRUMENT_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final LocalDate FROM = LocalDate.of(2025, 1, 1);
    private static final LocalDate TO = LocalDate.of(2025, 12, 31);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private InstrumentService instrumentService;

    @Autowired
    private SessionService sessionService;

    @BeforeEach
    void setUp() {
        reset(instrumentService);
        when(sessionService.resolve(SESSION_ID))
            .thenReturn(Optional.of(new AuthenticatedUser(USER_ID, "trader@example.com")));
    }

    @Test
    void candles_bindsDateBoundsAndReturnsDailyOhlcForAnAuthenticatedUser() throws Exception {
        when(instrumentService.getCandles(INSTRUMENT_ID, FROM, TO)).thenReturn(List.of(
            new InstrumentCandleResponse(
                LocalDate.of(2025, 4, 3),
                new BigDecimal("101.25"),
                new BigDecimal("104.50"),
                new BigDecimal("99.75"),
                new BigDecimal("103.00"),
                1200L,
                "USD"
            )
        ));

        mockMvc.perform(get("/api/instruments/{instrumentId}/candles", INSTRUMENT_ID)
                .param("from", FROM.toString())
                .param("to", TO.toString())
                .cookie(authCookie()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].date").value("2025-04-03"))
            .andExpect(jsonPath("$[0].open").value(101.25))
            .andExpect(jsonPath("$[0].high").value(104.50))
            .andExpect(jsonPath("$[0].low").value(99.75))
            .andExpect(jsonPath("$[0].close").value(103.00))
            .andExpect(jsonPath("$[0].volume").value(1200))
            .andExpect(jsonPath("$[0].currency").value("USD"));

        verify(instrumentService).getCandles(INSTRUMENT_ID, FROM, TO);
    }

    @Test
    void candles_requiresAnAuthenticatedSession() throws Exception {
        mockMvc.perform(get("/api/instruments/{instrumentId}/candles", INSTRUMENT_ID))
            .andExpect(status().isUnauthorized());
    }

    private Cookie authCookie() {
        return new Cookie(SessionAuthenticationFilter.SESSION_COOKIE, SESSION_ID.toString());
    }

    @TestConfiguration
    static class TestBeans {
        @Bean
        InstrumentService instrumentService() {
            return mock(InstrumentService.class);
        }

        @Bean
        PriceHistoryService priceHistoryService() {
            return mock(PriceHistoryService.class);
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