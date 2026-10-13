package io.github.jackhudsonn.jaakd.service;

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
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
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

    public List<AuditUserSearchResponse> searchUsers(String query, Integer page, Integer size) {
        privilegedAccessService.ensureAdminOrAuditor();

        String normalizedQuery = normalizeRequiredQuery(query);
        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;

        validatePaging(resolvedPage, resolvedSize);

        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);
        List<AuditUserSearchProjection> rows = userRepository.findByAuditSearchQuery(normalizedQuery, pageable).getContent();

        List<AuditUserSearchResponse> responses = new ArrayList<>();
        for (AuditUserSearchProjection row : rows) {
            responses.add(new AuditUserSearchResponse(
                row.getUserId(),
                row.getEmail(),
                row.getUsername(),
                row.getFirstName(),
                row.getLastName()
            ));
        }

        return responses;
    }

    public List<OrderLogResponse> searchOrderLogs(
        UUID userId,
        LocalDate date,
        OrderStatus status,
        String ticker,
        InstrumentClass instrumentType,
        Integer page,
        Integer size
    ) {
        privilegedAccessService.ensureAdminOrAuditor();

        if (date == null) {
            throw new ValidationException("Date is required");
        }

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        String normalizedTicker = normalizeOptionalText(ticker);
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end = date.plusDays(1).atStartOfDay();
        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);

        List<OrderLog> rows = orderLogRepository.findByAuditFiltersWithinTimestampRange(
            userId,
            start,
            end,
            status,
            normalizedTicker,
            instrumentType,
            pageable
        ).getContent();

        List<OrderLogResponse> responses = new ArrayList<>();
        for (OrderLog row : rows) {
            responses.add(toOrderLogResponse(row));
        }

        return responses;
    }

    public List<PortfolioResponse> getUserPortfolios(UUID userId, Integer page, Integer size) {
        privilegedAccessService.ensureAdminOrAuditor();
        validateRequiredUuid(userId, "User ID is required");

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);
        List<Portfolio> rows = portfolioRepository
            .findByProfileUserIdOrderByPortfolioIdAsc(userId, pageable)
            .getContent();

        List<PortfolioResponse> responses = new ArrayList<>();
        for (Portfolio row : rows) {
            responses.add(new PortfolioResponse(row.getPortfolioId(), row.getPortfolioName()));
        }

        return responses;
    }

    public List<Holding> getUserHoldings(UUID userId, UUID portfolioId, Integer page, Integer size) {
        privilegedAccessService.ensureAdminOrAuditor();
        validateRequiredUuid(userId, "User ID is required");

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);
        return holdingRepository.findByAuditUserIdAndOptionalPortfolioId(userId, portfolioId, pageable).getContent();
    }

    public List<PositionLotResponse> getHoldingPositionLots(UUID holdingId, Integer page, Integer size) {
        privilegedAccessService.ensureAdminOrAuditor();
        validateRequiredUuid(holdingId, "Holding ID is required");

        holdingRepository.findById(holdingId)
            .orElseThrow(() -> new HoldingNotFoundException(holdingId));

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);
        List<PositionLot> rows = positionLotRepository.findByHoldingIdOldestFirst(holdingId, pageable).getContent();

        List<PositionLotResponse> responses = new ArrayList<>();
        for (PositionLot row : rows) {
            responses.add(toPositionLotResponse(row));
        }

        return responses;
    }

    public List<LotMatchResponse> getHoldingLotMatches(UUID holdingId, Integer page, Integer size) {
        privilegedAccessService.ensureAdminOrAuditor();
        validateRequiredUuid(holdingId, "Holding ID is required");

        holdingRepository.findById(holdingId)
            .orElseThrow(() -> new HoldingNotFoundException(holdingId));

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);
        List<LotMatch> rows = lotMatchRepository.findByHoldingIdOldestFirst(holdingId, pageable).getContent();

        List<LotMatchResponse> responses = new ArrayList<>();
        for (LotMatch row : rows) {
            responses.add(toLotMatchResponse(row));
        }

        return responses;
    }

    private String normalizeRequiredQuery(String query) {
        if (query == null || query.isBlank()) {
            throw new ValidationException("Query is required");
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
