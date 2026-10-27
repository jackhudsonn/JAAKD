package io.github.jackhudsonn.jaakd.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.github.jackhudsonn.jaakd.config.SecurityConfig;
import io.github.jackhudsonn.jaakd.exception.ConflictException;
import io.github.jackhudsonn.jaakd.exception.ForbiddenException;
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

import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = InstrumentController.class)
@Import({ SecurityConfig.class, InstrumentPriceRefreshContractTest.TestBeans.class })
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class InstrumentPriceRefreshContractTest {

    private static final UUID SESSION_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PriceHistoryService priceHistoryService;

    @Autowired
    private SessionService sessionService;

    @BeforeEach
    void setUp() {
        reset(priceHistoryService);
        when(sessionService.resolve(SESSION_ID))
            .thenReturn(Optional.of(new AuthenticatedUser(USER_ID, "admin@example.com")));
    }

    @Test
    void refresh_startsInTheBackgroundAndReturnsAccepted() throws Exception {
        mockMvc.perform(post("/api/instruments/prices/refresh").cookie(authCookie()))
            .andExpect(status().isAccepted());

        verify(priceHistoryService).startRefresh();
    }

    @Test
    void refresh_returnsConflictWhileARefreshIsRunning() throws Exception {
        doThrow(new ConflictException("A price history refresh is already running"))
            .when(priceHistoryService).startRefresh();

        mockMvc.perform(post("/api/instruments/prices/refresh").cookie(authCookie()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value("A price history refresh is already running"));
    }

    @Test
    void refresh_returnsForbiddenForNonAdmins() throws Exception {
        doThrow(new ForbiddenException("Admin user type is required")).when(priceHistoryService).startRefresh();

        mockMvc.perform(post("/api/instruments/prices/refresh").cookie(authCookie()))
            .andExpect(status().isForbidden());
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
