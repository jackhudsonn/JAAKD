package io.github.jackhudsonn.jaakd.controller;

import io.github.jackhudsonn.jaakd.dto.AuditUserSearchResponse;
import io.github.jackhudsonn.jaakd.dto.LotMatchResponse;
import io.github.jackhudsonn.jaakd.dto.OrderLogResponse;
import io.github.jackhudsonn.jaakd.dto.PortfolioResponse;
import io.github.jackhudsonn.jaakd.dto.PositionLotResponse;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.service.AuditService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping("/users")
    @ResponseStatus(HttpStatus.OK)
    public List<AuditUserSearchResponse> searchUsers(
        @RequestParam String query,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        return auditService.searchUsers(query, page, size);
    }

    @GetMapping("/order-logs")
    @ResponseStatus(HttpStatus.OK)
    public List<OrderLogResponse> searchOrderLogs(
        @RequestParam(required = false) UUID userId,
        @RequestParam LocalDate date,
        @RequestParam(required = false) OrderStatus status,
        @RequestParam(required = false) String ticker,
        @RequestParam(required = false) InstrumentClass instrumentType,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        return auditService.searchOrderLogs(userId, date, status, ticker, instrumentType, page, size);
    }

    @GetMapping("/users/{userId}/portfolios")
    @ResponseStatus(HttpStatus.OK)
    public List<PortfolioResponse> getUserPortfolios(
        @PathVariable UUID userId,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        return auditService.getUserPortfolios(userId, page, size);
    }

    @GetMapping("/users/{userId}/holdings")
    @ResponseStatus(HttpStatus.OK)
    public List<Holding> getUserHoldings(
        @PathVariable UUID userId,
        @RequestParam(required = false) UUID portfolioId,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        return auditService.getUserHoldings(userId, portfolioId, page, size);
    }

    @GetMapping("/holdings/{holdingId}/position-lots")
    @ResponseStatus(HttpStatus.OK)
    public List<PositionLotResponse> getHoldingPositionLots(
        @PathVariable UUID holdingId,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        return auditService.getHoldingPositionLots(holdingId, page, size);
    }

    @GetMapping("/holdings/{holdingId}/lot-matches")
    @ResponseStatus(HttpStatus.OK)
    public List<LotMatchResponse> getHoldingLotMatches(
        @PathVariable UUID holdingId,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        return auditService.getHoldingLotMatches(holdingId, page, size);
    }
}
