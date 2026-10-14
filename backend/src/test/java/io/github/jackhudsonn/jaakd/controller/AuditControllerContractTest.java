package io.github.jackhudsonn.jaakd.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.github.jackhudsonn.jaakd.config.SecurityConfig;
import io.github.jackhudsonn.jaakd.dto.AuditPageResponse;
import io.github.jackhudsonn.jaakd.dto.AuditUserSearchResponse;
import io.github.jackhudsonn.jaakd.dto.OrderLogResponse;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.security.AuthenticatedUser;
import io.github.jackhudsonn.jaakd.security.SessionAuthenticationFilter;
import io.github.jackhudsonn.jaakd.service.AuditService;
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
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AuditController.class)
@Import({ SecurityConfig.class, AuditControllerContractTest.TestBeans.class })
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class AuditControllerContractTest {

    private static final UUID SESSION_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AuditService auditService;

    @Autowired
    private SessionService sessionService;

    @BeforeEach
    void setUp() {
        when(sessionService.resolve(SESSION_ID))
            .thenReturn(Optional.of(new AuthenticatedUser(USER_ID, "auditor@example.com")));
    }

    @Test
    void searchUsers_bindsOptionalQueryAndReturnsPagedEnvelope() throws Exception {
        AuditPageResponse<AuditUserSearchResponse> page = new AuditPageResponse<>(
            List.of(new AuditUserSearchResponse(
                USER_ID,
                "auditor@example.com",
                "auditor",
                "Audit",
                "User"
            )),
            0,
            25,
            1,
            1,
            false
        );

        when(auditService.searchUsers(null, 0, 25)).thenReturn(page);

        mockMvc.perform(get("/api/audit/users")
                .cookie(authCookie())
                .queryParam("page", "0")
                .queryParam("size", "25")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].userId").value(USER_ID.toString()))
            .andExpect(jsonPath("$.content[0].email").value("auditor@example.com"))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.hasNext").value(false));

        verify(auditService).searchUsers(null, 0, 25);
    }

    @Test
    void searchOrderLogs_bindsDateRangeAndStatusFilters() throws Exception {
        UUID logOrderId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        LocalDate fromDate = LocalDate.of(2026, 10, 1);
        LocalDate toDate = LocalDate.of(2026, 10, 14);

        AuditPageResponse<OrderLogResponse> page = new AuditPageResponse<>(
            List.of(new OrderLogResponse(
                logOrderId,
                orderId,
                portfolioId,
                instrumentId,
                OrderSide.BUY,
                10.0,
                LocalDateTime.of(2026, 10, 14, 9, 30),
                "meta",
                OrderStatus.EXECUTED,
                101.25,
                100.9
            )),
            0,
            25,
            1,
            1,
            false
        );

        when(auditService.searchOrderLogs(
            USER_ID,
            null,
            fromDate,
            toDate,
            OrderStatus.EXECUTED,
            null,
            null,
            null,
            0,
            25
        )).thenReturn(page);

        mockMvc.perform(get("/api/audit/order-logs")
                .cookie(authCookie())
                .queryParam("userId", USER_ID.toString())
                .queryParam("fromDate", "2026-10-01")
                .queryParam("toDate", "2026-10-14")
                .queryParam("status", "EXECUTED")
                .queryParam("page", "0")
                .queryParam("size", "25")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].status").value("EXECUTED"))
            .andExpect(jsonPath("$.content[0].orderId").value(orderId.toString()));

        verify(auditService).searchOrderLogs(
            USER_ID,
            null,
            fromDate,
            toDate,
            OrderStatus.EXECUTED,
            null,
            null,
            null,
            0,
            25
        );
    }

    @Test
    void getAuditHoldings_bindsOptionalFilters() throws Exception {
        UUID instrumentId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();

        Holding holding = new Holding(portfolioId, instrumentId);
        setField(holding, "holdingID", UUID.randomUUID());
        holding.setCurrentQuantity(BigDecimal.valueOf(12.5));
        holding.setCumulativeRealizedPnl(BigDecimal.valueOf(3.75));
        holding.setUpdatedAt(LocalDateTime.of(2026, 10, 14, 10, 0));

        AuditPageResponse<Holding> page = new AuditPageResponse<>(
            List.of(holding),
            0,
            25,
            1,
            1,
            false
        );

        when(auditService.getHoldings(USER_ID, portfolioId, instrumentId, 0, 25)).thenReturn(page);

        mockMvc.perform(get("/api/audit/holdings")
                .cookie(authCookie())
                .queryParam("userId", USER_ID.toString())
                .queryParam("portfolioId", portfolioId.toString())
                .queryParam("instrumentId", instrumentId.toString())
                .queryParam("page", "0")
                .queryParam("size", "25")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].portfolioID").value(portfolioId.toString()))
            .andExpect(jsonPath("$.content[0].instrumentID").value(instrumentId.toString()));

        verify(auditService).getHoldings(USER_ID, portfolioId, instrumentId, 0, 25);
    }

    @Test
    void getHoldingOrderLogs_bindsHoldingPathAndDateRange() throws Exception {
        UUID holdingId = UUID.randomUUID();
        LocalDate fromDate = LocalDate.of(2026, 10, 10);
        LocalDate toDate = LocalDate.of(2026, 10, 14);

        when(auditService.getHoldingOrderLogs(holdingId, fromDate, toDate, OrderStatus.FAILED, 1, 10))
            .thenReturn(new AuditPageResponse<>(List.of(), 1, 10, 0, 0, false));

        mockMvc.perform(get("/api/audit/holdings/{holdingId}/order-logs", holdingId)
                .cookie(authCookie())
                .queryParam("fromDate", "2026-10-10")
                .queryParam("toDate", "2026-10-14")
                .queryParam("status", "FAILED")
                .queryParam("page", "1")
                .queryParam("size", "10")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.page").value(1))
            .andExpect(jsonPath("$.size").value(10));

        verify(auditService).getHoldingOrderLogs(holdingId, fromDate, toDate, OrderStatus.FAILED, 1, 10);
    }

    private Cookie authCookie() {
        return new Cookie(SessionAuthenticationFilter.SESSION_COOKIE, SESSION_ID.toString());
    }

    private void setField(Object target, String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException ex) {
            throw new RuntimeException(ex);
        }
    }

    @TestConfiguration
    static class TestBeans {
        @Bean
        AuditService auditService() {
            return mock(AuditService.class);
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
