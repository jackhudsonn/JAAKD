package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.AuditPageResponse;
import io.github.jackhudsonn.jaakd.dto.AuditUserSearchResponse;
import io.github.jackhudsonn.jaakd.dto.OrderLogResponse;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.PositionLot;
import io.github.jackhudsonn.jaakd.model.LotMatch;
import io.github.jackhudsonn.jaakd.repository.UserRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.PositionLotRepository;
import io.github.jackhudsonn.jaakd.repository.LotMatchRepository;
import io.github.jackhudsonn.jaakd.repository.projection.AuditUserSearchProjection;
import io.github.jackhudsonn.jaakd.model.Profile;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private OrderLogRepository orderLogRepository;

    @Mock
    private PortfolioRepository portfolioRepository;

    @Mock
    private HoldingRepository holdingRepository;

    @Mock
    private PositionLotRepository positionLotRepository;

    @Mock
    private LotMatchRepository lotMatchRepository;

    @Mock
    private PrivilegedAccessService privilegedAccessService;

    @InjectMocks
    private AuditService auditService;

    @Test
    void searchUsers_validQuery_returnsMappedRowsAndUsesDefaults() {
        UUID userId = UUID.randomUUID();
        AuditUserSearchProjection row = projection(userId, "auditor@example.com", "auditor1", "Ada", "Lovelace");
        Page<AuditUserSearchProjection> page = new PageImpl<>(List.of(row));

        when(userRepository.findByAuditSearchQuery(eq("ada"), any(Pageable.class))).thenReturn(page);

        AuditPageResponse<AuditUserSearchResponse> result = auditService.searchUsers(" ada ", null, null);

        verify(privilegedAccessService, times(1)).ensureAdminOrAuditor();

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(userRepository, times(1)).findByAuditSearchQuery(eq("ada"), pageableCaptor.capture());
        assertEquals(PageRequest.of(0, 25), pageableCaptor.getValue());

        assertEquals(1, result.content().size());
        assertEquals(userId, result.content().get(0).userId());
        assertEquals("auditor@example.com", result.content().get(0).email());
        assertEquals("auditor1", result.content().get(0).username());
    }

    @Test
    void searchUsers_customPageAndSize_usesProvidedValues() {
        when(userRepository.findByAuditSearchQuery(eq("alice"), any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        auditService.searchUsers("alice", 2, 10);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(userRepository, times(1)).findByAuditSearchQuery(eq("alice"), pageableCaptor.capture());
        assertEquals(PageRequest.of(2, 10), pageableCaptor.getValue());
    }

    @Test
    void searchUsers_blankQuery_isAllowedAndSearchesAll() {
        when(userRepository.findByAuditSearchQuery(eq(""), any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        auditService.searchUsers("   ", 0, 25);

        verify(privilegedAccessService, times(1)).ensureAdminOrAuditor();
        verify(userRepository, times(1)).findByAuditSearchQuery(eq(""), any(Pageable.class));
    }

    @Test
    void searchUsers_missingQuery_isAllowedAndSearchesAll() {
        when(userRepository.findByAuditSearchQuery(eq(""), any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        auditService.searchUsers(null, 0, 25);

        verify(privilegedAccessService, times(1)).ensureAdminOrAuditor();
        verify(userRepository, times(1)).findByAuditSearchQuery(eq(""), any(Pageable.class));
    }

    @Test
    void searchUsers_invalidPage_throwsValidation() {
        assertThrows(ValidationException.class, () -> auditService.searchUsers("x", -1, 25));

        verify(privilegedAccessService, times(1)).ensureAdminOrAuditor();
        verify(userRepository, never()).findByAuditSearchQuery(any(), any(Pageable.class));
    }

    @Test
    void searchUsers_invalidSize_throwsValidation() {
        assertThrows(ValidationException.class, () -> auditService.searchUsers("x", 0, 101));

        verify(privilegedAccessService, times(1)).ensureAdminOrAuditor();
        verify(userRepository, never()).findByAuditSearchQuery(any(), any(Pageable.class));
    }

    @Test
    void searchUsers_emptyResults_returnsEmptyList() {
        when(userRepository.findByAuditSearchQuery(eq("none"), any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        AuditPageResponse<AuditUserSearchResponse> result = auditService.searchUsers("none", null, null);

        assertEquals(0, result.content().size());
    }

    @Test
    void searchOrderLogs_requiredDateAndOptionalFilters_usesDayBoundaryQueryAndMapsResponse() {
        UUID userId = UUID.randomUUID();
        UUID logOrderId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        LocalDate date = LocalDate.of(2026, 10, 13);
        LocalDateTime timestamp = LocalDateTime.of(2026, 10, 13, 12, 30, 0);

        OrderLog row = orderLog(logOrderId, orderId, portfolioId, instrumentId, timestamp);
        when(orderLogRepository.findAll(any(Specification.class), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(row)));

        AuditPageResponse<OrderLogResponse> result = auditService.searchOrderLogs(
            userId,
            date,
            null,
            null,
            OrderStatus.EXECUTED,
            " AAPL ",
            instrumentId,
            InstrumentClass.EQUITY,
            null,
            null
        );

        verify(privilegedAccessService, times(1)).ensureAdminOrAuditor();

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(orderLogRepository, times(1)).findAll(any(Specification.class), pageableCaptor.capture());
        assertEquals(
            PageRequest.of(0, 25, Sort.by(Sort.Order.desc("timestamp"), Sort.Order.desc("logOrderID"))),
            pageableCaptor.getValue()
        );

        assertEquals(1, result.content().size());
        assertEquals(logOrderId, result.content().get(0).logOrderId());
        assertEquals(orderId, result.content().get(0).orderId());
        assertEquals(portfolioId, result.content().get(0).portfolioId());
        assertEquals(instrumentId, result.content().get(0).instrumentId());
        assertEquals(OrderStatus.EXECUTED, result.content().get(0).status());
    }

    @Test
    void searchOrderLogs_blankTicker_isTreatedAsNull() {
        LocalDate date = LocalDate.of(2026, 10, 13);
        when(orderLogRepository.findAll(any(Specification.class), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of()));

        auditService.searchOrderLogs(null, date, null, null, null, "   ", null, null, 1, 10);

        verify(orderLogRepository, times(1)).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void searchOrderLogs_missingDate_isAllowedAndUsesNullDateBounds() {
        when(orderLogRepository.findAll(any(Specification.class), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of()));

        auditService.searchOrderLogs(null, null, null, null, null, null, null, null, 0, 25);

        verify(privilegedAccessService, times(1)).ensureAdminOrAuditor();
        verify(orderLogRepository, times(1)).findAll(
            any(Specification.class),
            eq(PageRequest.of(0, 25, Sort.by(Sort.Order.desc("timestamp"), Sort.Order.desc("logOrderID"))))
        );
    }

    @Test
    void searchOrderLogs_invalidPage_throwsValidation() {
        LocalDate date = LocalDate.of(2026, 10, 13);

        assertThrows(
            ValidationException.class,
            () -> auditService.searchOrderLogs(null, date, null, null, null, null, null, null, -1, 25)
        );

        verify(orderLogRepository, never()).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void searchOrderLogs_invalidSize_throwsValidation() {
        LocalDate date = LocalDate.of(2026, 10, 13);

        assertThrows(
            ValidationException.class,
            () -> auditService.searchOrderLogs(null, date, null, null, null, null, null, null, 0, 101)
        );

        verify(orderLogRepository, never()).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void getUserPortfolios_mapsResultsAndUsesDefaultPaging() {
        UUID userId = UUID.randomUUID();
        Portfolio portfolio = new Portfolio(new Profile(UUID.randomUUID(), BigDecimal.ZERO));
        setField(portfolio, "portfolioId", UUID.randomUUID());
        portfolio.setPortfolioName("Growth");

        when(portfolioRepository.findByProfileUserIdOrderByPortfolioIdAsc(eq(userId), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(portfolio)));

        AuditPageResponse<io.github.jackhudsonn.jaakd.dto.PortfolioResponse> result =
            auditService.getUserPortfolios(userId, null, null);

        verify(privilegedAccessService, times(1)).ensureAdminOrAuditor();
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(portfolioRepository, times(1))
            .findByProfileUserIdOrderByPortfolioIdAsc(eq(userId), pageableCaptor.capture());
        assertEquals(PageRequest.of(0, 25), pageableCaptor.getValue());

        assertEquals(1, result.content().size());
        assertEquals("Growth", result.content().get(0).portfolioName());
    }

    @Test
    void getUserHoldings_appliesOptionalPortfolioFilterAndPaging() {
        UUID userId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        Holding holding = new Holding(portfolioId, UUID.randomUUID());

        when(holdingRepository.findByAuditOptionalFilters(eq(userId), eq(portfolioId), eq(null), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(holding)));

        AuditPageResponse<Holding> result = auditService.getUserHoldings(userId, portfolioId, null, 1, 10);

        verify(privilegedAccessService, times(1)).ensureAdminOrAuditor();
        verify(holdingRepository, times(1)).findByAuditOptionalFilters(eq(userId), eq(portfolioId), eq(null), eq(PageRequest.of(1, 10)));
        assertEquals(1, result.content().size());
    }

    @Test
    void getHoldingPositionLots_mapsResultsAndChecksHoldingExists() {
        UUID holdingId = UUID.randomUUID();
        PositionLot lot = new PositionLot(
            holdingId,
            UUID.randomUUID(),
            LocalDateTime.of(2026, 10, 13, 10, 0),
            BigDecimal.valueOf(10),
            BigDecimal.valueOf(6),
            BigDecimal.valueOf(100)
        );

        when(holdingRepository.findById(holdingId)).thenReturn(java.util.Optional.of(new Holding(UUID.randomUUID(), UUID.randomUUID())));
        when(positionLotRepository.findByHoldingIdOldestFirst(eq(holdingId), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(lot)));

        AuditPageResponse<io.github.jackhudsonn.jaakd.dto.PositionLotResponse> result =
            auditService.getHoldingPositionLots(holdingId, null, null);

        verify(privilegedAccessService, times(1)).ensureAdminOrAuditor();
        verify(holdingRepository, times(1)).findById(holdingId);
        verify(positionLotRepository, times(1)).findByHoldingIdOldestFirst(eq(holdingId), eq(PageRequest.of(0, 25)));
        assertEquals(1, result.content().size());
        assertEquals(holdingId, result.content().get(0).holdingId());
    }

    @Test
    void getHoldingLotMatches_mapsResultsAndChecksHoldingExists() {
        UUID holdingId = UUID.randomUUID();
        LotMatch lotMatch = new LotMatch(
            UUID.randomUUID(),
            UUID.randomUUID(),
            holdingId,
            BigDecimal.valueOf(2),
            BigDecimal.valueOf(120),
            BigDecimal.valueOf(40),
            LocalDateTime.of(2026, 10, 13, 11, 0)
        );

        when(holdingRepository.findById(holdingId)).thenReturn(java.util.Optional.of(new Holding(UUID.randomUUID(), UUID.randomUUID())));
        when(lotMatchRepository.findByHoldingIdOldestFirst(eq(holdingId), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(lotMatch)));

        AuditPageResponse<io.github.jackhudsonn.jaakd.dto.LotMatchResponse> result =
            auditService.getHoldingLotMatches(holdingId, 0, 25);

        verify(privilegedAccessService, times(1)).ensureAdminOrAuditor();
        verify(holdingRepository, times(1)).findById(holdingId);
        verify(lotMatchRepository, times(1)).findByHoldingIdOldestFirst(eq(holdingId), eq(PageRequest.of(0, 25)));
        assertEquals(1, result.content().size());
        assertEquals(holdingId, result.content().get(0).holdingId());
    }

    private OrderLog orderLog(
        UUID logOrderId,
        UUID orderId,
        UUID portfolioId,
        UUID instrumentId,
        LocalDateTime timestamp
    ) {
        Profile profile = new Profile(UUID.randomUUID(), BigDecimal.ZERO);
        Portfolio portfolio = new Portfolio(profile);
        Instrument instrument = new Instrument("AAPL", "NASDAQ", "Apple", InstrumentClass.EQUITY);
        OrderLog orderLog = new OrderLog(orderId, portfolio, instrument, OrderSide.BUY, 10.0);
        orderLog.setStatus(OrderStatus.EXECUTED);
        orderLog.setMetadata("meta");
        orderLog.setExecutionPrice(101.25);
        orderLog.setQuotedPrice(101.00);

        setField(orderLog, "logOrderID", logOrderId);
        setField(orderLog, "timestamp", timestamp);
        setField(portfolio, "portfolioId", portfolioId);
        setField(instrument, "instrumentId", instrumentId);

        return orderLog;
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

    private AuditUserSearchProjection projection(
        UUID userId,
        String email,
        String username,
        String firstName,
        String lastName
    ) {
        return new AuditUserSearchProjection() {
            @Override
            public UUID getUserId() {
                return userId;
            }

            @Override
            public String getEmail() {
                return email;
            }

            @Override
            public String getUsername() {
                return username;
            }

            @Override
            public String getFirstName() {
                return firstName;
            }

            @Override
            public String getLastName() {
                return lastName;
            }
        };
    }
}
