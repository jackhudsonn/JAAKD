package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.AuditPageResponse;
import io.github.jackhudsonn.jaakd.dto.AuditUserSearchResponse;
import io.github.jackhudsonn.jaakd.dto.LotMatchResponse;
import io.github.jackhudsonn.jaakd.dto.OrderLogResponse;
import io.github.jackhudsonn.jaakd.dto.PortfolioResponse;
import io.github.jackhudsonn.jaakd.dto.PositionLotResponse;
import io.github.jackhudsonn.jaakd.exception.HoldingNotFoundException;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.LotMatch;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.PositionLot;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.LotMatchRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import io.github.jackhudsonn.jaakd.repository.PositionLotRepository;
import io.github.jackhudsonn.jaakd.repository.UserRepository;
import io.github.jackhudsonn.jaakd.repository.projection.AuditUserSearchProjection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class AuditService {

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 25;
    private static final int MAX_SIZE = 100;

    private final UserRepository userRepository;
    private final OrderLogRepository orderLogRepository;
    private final PortfolioRepository portfolioRepository;
    private final HoldingRepository holdingRepository;
    private final PositionLotRepository positionLotRepository;
    private final LotMatchRepository lotMatchRepository;
    private final PrivilegedAccessService privilegedAccessService;

    public AuditService(
        UserRepository userRepository,
        OrderLogRepository orderLogRepository,
        PortfolioRepository portfolioRepository,
        HoldingRepository holdingRepository,
        PositionLotRepository positionLotRepository,
        LotMatchRepository lotMatchRepository,
        PrivilegedAccessService privilegedAccessService
    ) {
        this.userRepository = userRepository;
        this.orderLogRepository = orderLogRepository;
        this.portfolioRepository = portfolioRepository;
        this.holdingRepository = holdingRepository;
        this.positionLotRepository = positionLotRepository;
        this.lotMatchRepository = lotMatchRepository;
        this.privilegedAccessService = privilegedAccessService;
    }

    public AuditPageResponse<AuditUserSearchResponse> searchUsers(String query, Integer page, Integer size) {
        privilegedAccessService.ensureAdminOrAuditor();

        String normalizedQuery = normalizeOptionalQuery(query);
        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;

        validatePaging(resolvedPage, resolvedSize);

        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);
        Page<AuditUserSearchProjection> rows = userRepository.findByAuditSearchQuery(normalizedQuery, pageable);

        return AuditPageResponse.from(rows.map(row -> new AuditUserSearchResponse(
                row.getUserId(),
                row.getEmail(),
                row.getUsername(),
                row.getFirstName(),
                row.getLastName()
            )));
    }

    public AuditPageResponse<OrderLogResponse> searchOrderLogs(
        UUID userId,
        LocalDate date,
        LocalDate fromDate,
        LocalDate toDate,
        OrderStatus status,
        String ticker,
        UUID instrumentId,
        InstrumentClass instrumentType,
        Integer page,
        Integer size
    ) {
        privilegedAccessService.ensureAdminOrAuditor();

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        validateDateRange(fromDate, toDate);

        String normalizedTicker = normalizeOptionalText(ticker);
        if (normalizedTicker != null) {
            normalizedTicker = normalizedTicker.toUpperCase();
        }
        LocalDateTime start = resolveStartDateTime(date, fromDate);
        LocalDateTime end = resolveEndDateTime(date, toDate);
        Pageable pageable = PageRequest.of(
            resolvedPage,
            resolvedSize,
            Sort.by(Sort.Order.desc("timestamp"), Sort.Order.desc("logOrderID"))
        );

        Specification<OrderLog> specification = buildAuditOrderLogSpecification(
            userId,
            start,
            end,
            status,
            normalizedTicker,
            instrumentId,
            instrumentType
        );

        Page<OrderLog> rows = orderLogRepository.findAll(specification, pageable);

        return AuditPageResponse.from(rows.map(this::toOrderLogResponse));
    }

    public AuditPageResponse<PortfolioResponse> getUserPortfolios(UUID userId, Integer page, Integer size) {
        privilegedAccessService.ensureAdminOrAuditor();
        validateRequiredUuid(userId, "User ID is required");

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);
        Page<Portfolio> rows = portfolioRepository.findByProfileUserIdOrderByPortfolioIdAsc(userId, pageable);
        return AuditPageResponse.from(rows.map(row -> new PortfolioResponse(row.getPortfolioId(), row.getPortfolioName())));
    }

    public AuditPageResponse<Holding> getHoldings(
        UUID userId,
        UUID portfolioId,
        UUID instrumentId,
        Integer page,
        Integer size
    ) {
        privilegedAccessService.ensureAdminOrAuditor();

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);
        Page<Holding> rows = holdingRepository.findByAuditOptionalFilters(userId, portfolioId, instrumentId, pageable);
        return AuditPageResponse.from(rows);
    }

    public AuditPageResponse<Holding> getUserHoldings(
        UUID userId,
        UUID portfolioId,
        UUID instrumentId,
        Integer page,
        Integer size
    ) {
        validateRequiredUuid(userId, "User ID is required");
        return getHoldings(userId, portfolioId, instrumentId, page, size);
    }

    public AuditPageResponse<OrderLogResponse> getHoldingOrderLogs(
        UUID holdingId,
        LocalDate fromDate,
        LocalDate toDate,
        OrderStatus status,
        Integer page,
        Integer size
    ) {
        privilegedAccessService.ensureAdminOrAuditor();
        validateRequiredUuid(holdingId, "Holding ID is required");
        validateDateRange(fromDate, toDate);

        Holding holding = holdingRepository.findById(holdingId)
            .orElseThrow(() -> new HoldingNotFoundException(holdingId));

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        LocalDateTime start = fromDate == null ? null : fromDate.atStartOfDay();
        LocalDateTime end = toDate == null ? null : toDate.plusDays(1).atStartOfDay();
        Pageable pageable = PageRequest.of(
            resolvedPage,
            resolvedSize,
            Sort.by(Sort.Order.desc("timestamp"), Sort.Order.desc("logOrderID"))
        );

        Specification<OrderLog> specification = buildHoldingOrderLogSpecification(
            holding.getPortfolioID(),
            holding.getInstrumentID(),
            start,
            end,
            status
        );

        Page<OrderLog> rows = orderLogRepository.findAll(specification, pageable);

        return AuditPageResponse.from(rows.map(this::toOrderLogResponse));
    }

    public AuditPageResponse<PositionLotResponse> getHoldingPositionLots(UUID holdingId, Integer page, Integer size) {
        privilegedAccessService.ensureAdminOrAuditor();
        validateRequiredUuid(holdingId, "Holding ID is required");

        holdingRepository.findById(holdingId)
            .orElseThrow(() -> new HoldingNotFoundException(holdingId));

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);
        Page<PositionLot> rows = positionLotRepository.findByHoldingIdOldestFirst(holdingId, pageable);
        return AuditPageResponse.from(rows.map(this::toPositionLotResponse));
    }

    public AuditPageResponse<LotMatchResponse> getHoldingLotMatches(UUID holdingId, Integer page, Integer size) {
        privilegedAccessService.ensureAdminOrAuditor();
        validateRequiredUuid(holdingId, "Holding ID is required");

        holdingRepository.findById(holdingId)
            .orElseThrow(() -> new HoldingNotFoundException(holdingId));

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);
        Page<LotMatch> rows = lotMatchRepository.findByHoldingIdOldestFirst(holdingId, pageable);
        return AuditPageResponse.from(rows.map(this::toLotMatchResponse));
    }

    private void validateDateRange(LocalDate fromDate, LocalDate toDate) {
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new ValidationException("From date must be before or equal to to date");
        }
    }

    private LocalDateTime resolveStartDateTime(LocalDate date, LocalDate fromDate) {
        if (fromDate != null) {
            return fromDate.atStartOfDay();
        }

        return date == null ? null : date.atStartOfDay();
    }

    private LocalDateTime resolveEndDateTime(LocalDate date, LocalDate toDate) {
        if (toDate != null) {
            return toDate.plusDays(1).atStartOfDay();
        }

        return date == null ? null : date.plusDays(1).atStartOfDay();
    }

    private String normalizeOptionalQuery(String query) {
        if (query == null) {
            return "";
        }

        return query.trim();
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void validatePaging(int page, int size) {
        if (page < 0) {
            throw new ValidationException("Page must be greater than or equal to 0");
        }

        if (size < 1 || size > MAX_SIZE) {
            throw new ValidationException("Size must be between 1 and 100");
        }
    }

    private void validateRequiredUuid(UUID value, String message) {
        if (value == null) {
            throw new ValidationException(message);
        }
    }

    private Specification<OrderLog> buildAuditOrderLogSpecification(
        UUID userId,
        LocalDateTime start,
        LocalDateTime end,
        OrderStatus status,
        String ticker,
        UUID instrumentId,
        InstrumentClass instrumentType
    ) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            var portfolioJoin = root.join("portfolio");
            var instrumentJoin = root.join("instrument");

            if (start != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("timestamp"), start));
            }

            if (end != null) {
                predicates.add(cb.lessThan(root.get("timestamp"), end));
            }

            if (userId != null) {
                predicates.add(cb.equal(portfolioJoin.join("profile").get("userId"), userId));
            }

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            if (ticker != null) {
                predicates.add(cb.equal(cb.upper(instrumentJoin.get("ticker")), ticker));
            }

            if (instrumentId != null) {
                predicates.add(cb.equal(instrumentJoin.get("instrumentId"), instrumentId));
            }

            if (instrumentType != null) {
                predicates.add(cb.equal(instrumentJoin.get("instrumentClass"), instrumentType));
            }

            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    private Specification<OrderLog> buildHoldingOrderLogSpecification(
        UUID portfolioId,
        UUID instrumentId,
        LocalDateTime start,
        LocalDateTime end,
        OrderStatus status
    ) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            var portfolioJoin = root.join("portfolio");
            var instrumentJoin = root.join("instrument");

            predicates.add(cb.equal(portfolioJoin.get("portfolioId"), portfolioId));
            predicates.add(cb.equal(instrumentJoin.get("instrumentId"), instrumentId));

            if (start != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("timestamp"), start));
            }

            if (end != null) {
                predicates.add(cb.lessThan(root.get("timestamp"), end));
            }

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    private OrderLogResponse toOrderLogResponse(OrderLog orderLog) {
        return new OrderLogResponse(
            orderLog.getLogOrderID(),
            orderLog.getOrderId(),
            orderLog.getPortfolio().getPortfolioId(),
            orderLog.getInstrument().getInstrumentId(),
            orderLog.getSide(),
            orderLog.getQuantity(),
            orderLog.getTimeStamp(),
            orderLog.getMetadata(),
            orderLog.getStatus(),
            orderLog.getExecutionPrice(),
            orderLog.getQuotedPrice()
        );
    }

    private PositionLotResponse toPositionLotResponse(PositionLot positionLot) {
        return new PositionLotResponse(
            positionLot.getPositionLotID(),
            positionLot.getHoldingID(),
            positionLot.getSourceBuyLogOrderID(),
            positionLot.getOpenedAt(),
            positionLot.getOriginalQuantity(),
            positionLot.getRemainingQuantity(),
            positionLot.getUnitCost()
        );
    }

    private LotMatchResponse toLotMatchResponse(LotMatch lotMatch) {
        return new LotMatchResponse(
            lotMatch.getLotMatchID(),
            lotMatch.getSellLogOrderID(),
            lotMatch.getPositionLotID(),
            lotMatch.getHoldingID(),
            lotMatch.getMatchedQuantity(),
            lotMatch.getSellUnitPrice(),
            lotMatch.getRealizedPnlAmount(),
            lotMatch.getMatchedAt()
        );
    }
}
