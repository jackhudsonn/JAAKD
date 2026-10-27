package io.github.jackhudsonn.jaakd.controller;

import io.github.jackhudsonn.jaakd.dto.AuditPageResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.AnalyticsMetaResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.ClassSummaryResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.ClassValuePoint;
import io.github.jackhudsonn.jaakd.dto.analytics.HoldingSnapshotResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.HoldingValuePoint;
import io.github.jackhudsonn.jaakd.dto.analytics.InstrumentPerformanceResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.InstrumentPricePoint;
import io.github.jackhudsonn.jaakd.dto.analytics.PortfolioPerformanceResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.PortfolioValuePoint;
import io.github.jackhudsonn.jaakd.dto.analytics.SegmentExposureResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.SegmentSummaryResponse;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.service.AnalyticsService;
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
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/meta")
    @ResponseStatus(HttpStatus.OK)
    public AnalyticsMetaResponse getMeta() {
        return analyticsService.getMeta();
    }

    @GetMapping("/summary")
    @ResponseStatus(HttpStatus.OK)
    public List<ClassSummaryResponse> getSummary(
        @RequestParam(required = false) String country,
        @RequestParam(required = false) String ageBand
    ) {
        return analyticsService.getClassSummary(country, ageBand);
    }

    @GetMapping("/countries")
    @ResponseStatus(HttpStatus.OK)
    public List<String> getCountries() {
        return analyticsService.getCountries();
    }

    @GetMapping("/segments")
    @ResponseStatus(HttpStatus.OK)
    public List<SegmentSummaryResponse> getSegments(@RequestParam(required = false) String by) {
        return analyticsService.getSegments(by);
    }

    @GetMapping("/segments/exposure")
    @ResponseStatus(HttpStatus.OK)
    public List<SegmentExposureResponse> getSegmentExposure(
        @RequestParam(required = false) String by,
        @RequestParam(required = false) InstrumentClass instrumentClass,
        @RequestParam(required = false) UUID instrumentId
    ) {
        return analyticsService.getSegmentExposure(by, instrumentClass, instrumentId);
    }

    @GetMapping("/instruments")
    @ResponseStatus(HttpStatus.OK)
    public AuditPageResponse<InstrumentPerformanceResponse> listInstruments(
        @RequestParam(required = false) InstrumentClass instrumentClass,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String country,
        @RequestParam(required = false) String ageBand,
        @RequestParam(required = false) String sort,
        @RequestParam(required = false) String direction,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        return analyticsService.listInstruments(instrumentClass, search, country, ageBand, sort, direction, page, size);
    }

    @GetMapping("/instruments/{instrumentId}")
    @ResponseStatus(HttpStatus.OK)
    public InstrumentPerformanceResponse getInstrument(@PathVariable UUID instrumentId) {
        return analyticsService.getInstrument(instrumentId);
    }

    @GetMapping("/instruments/{instrumentId}/series")
    @ResponseStatus(HttpStatus.OK)
    public List<InstrumentPricePoint> getInstrumentSeries(
        @PathVariable UUID instrumentId,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to
    ) {
        return analyticsService.getInstrumentSeries(instrumentId, from, to);
    }

    @GetMapping("/portfolios")
    @ResponseStatus(HttpStatus.OK)
    public AuditPageResponse<PortfolioPerformanceResponse> listPortfolios(
        @RequestParam(required = false) String country,
        @RequestParam(required = false) String ageBand,
        @RequestParam(required = false) String sort,
        @RequestParam(required = false) String direction,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        return analyticsService.listPortfolios(country, ageBand, sort, direction, page, size);
    }

    @GetMapping("/portfolios/{portfolioId}")
    @ResponseStatus(HttpStatus.OK)
    public PortfolioPerformanceResponse getPortfolio(@PathVariable UUID portfolioId) {
        return analyticsService.getPortfolio(portfolioId);
    }

    @GetMapping("/portfolios/{portfolioId}/series")
    @ResponseStatus(HttpStatus.OK)
    public List<PortfolioValuePoint> getPortfolioSeries(
        @PathVariable UUID portfolioId,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to
    ) {
        return analyticsService.getPortfolioSeries(portfolioId, from, to);
    }

    @GetMapping("/portfolios/{portfolioId}/class-series")
    @ResponseStatus(HttpStatus.OK)
    public List<ClassValuePoint> getPortfolioClassSeries(
        @PathVariable UUID portfolioId,
        @RequestParam InstrumentClass instrumentClass,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to
    ) {
        return analyticsService.getPortfolioClassSeries(portfolioId, instrumentClass, from, to);
    }

    @GetMapping("/portfolios/{portfolioId}/holdings")
    @ResponseStatus(HttpStatus.OK)
    public List<HoldingSnapshotResponse> getPortfolioHoldings(@PathVariable UUID portfolioId) {
        return analyticsService.getPortfolioHoldings(portfolioId);
    }

    @GetMapping("/holdings/{holdingId}/series")
    @ResponseStatus(HttpStatus.OK)
    public List<HoldingValuePoint> getHoldingSeries(
        @PathVariable UUID holdingId,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to
    ) {
        return analyticsService.getHoldingSeries(holdingId, from, to);
    }
}
