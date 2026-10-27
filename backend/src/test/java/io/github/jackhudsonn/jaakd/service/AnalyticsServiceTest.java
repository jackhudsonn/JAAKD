package io.github.jackhudsonn.jaakd.service;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import io.github.jackhudsonn.jaakd.config.AnalyticsDatabase;
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
import io.github.jackhudsonn.jaakd.dto.analytics.SegmentClassExposure;
import io.github.jackhudsonn.jaakd.dto.analytics.SegmentExposureResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.SegmentSummaryResponse;
import io.github.jackhudsonn.jaakd.exception.AnalyticsNotFoundException;
import io.github.jackhudsonn.jaakd.exception.AnalyticsUnavailableException;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.UserType;
import io.github.jackhudsonn.jaakd.security.RequiresUserType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Runs the service's real SQL against the mart contract recreated on H2 (PostgreSQL mode).
class AnalyticsServiceTest {

    private static final UUID AAPL = UUID.fromString("00000000-0000-0000-0000-00000000000a");
    private static final UUID BTC = UUID.fromString("00000000-0000-0000-0000-00000000000c");
    private static final UUID EURUSD =UUID.fromString("00000000-0000-0000-0000-00000000000d");
    private static final UUID PORTFOLIO_US = UUID.fromString("00000000-0000-0000-0000-0000000000f1");
    private static final UUID HOLDING_AAPL = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    private static final UUID UNKNOWN = UUID.fromString("99999999-9999-9999-9999-999999999999");

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-20T12:00:00Z"), ZoneOffset.UTC);

    private HikariDataSource dataSource;
    private AnalyticsDatabase analyticsDatabase;
    private AnalyticsService analyticsService;

    @BeforeEach
    void setUp() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:mem:analytics_test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1");
        config.setUsername("sa");
        config.setPassword("");
        dataSource = new HikariDataSource(config);

        new ResourceDatabasePopulator(new ClassPathResource("analytics-fixture.sql")).execute(dataSource);

        analyticsDatabase = new AnalyticsDatabase(dataSource);
        analyticsService = new AnalyticsService(providerOf(analyticsDatabase), CLOCK);
    }

    @AfterEach
    void tearDown() {
        analyticsDatabase.close();
    }

    @Test
    void service_isRestrictedToAdminsAndAnalysts() {
        RequiresUserType requirement = AnalyticsService.class.getAnnotation(RequiresUserType.class);

        assertArrayEquals(new UserType[] { UserType.ADMIN, UserType.ANALYST }, requirement.value());
    }

    @Test
    void getMeta_returnsBuildTimes() {
        AnalyticsMetaResponse meta = analyticsService.getMeta();

        assertEquals(OffsetDateTime.parse("2026-10-19T22:30:00Z").toInstant(), meta.sourceSnapshotAt().toInstant());
        assertEquals(OffsetDateTime.parse("2026-10-19T22:41:00Z").toInstant(), meta.builtAt().toInstant());
    }

    @Test
    void getMeta_returnsNullsBeforeTheFirstBuild() {
        analyticsDatabase.jdbcClient().sql("DELETE FROM analytics.meta_build").update();

        AnalyticsMetaResponse meta = analyticsService.getMeta();

        assertNull(meta.sourceSnapshotAt());
        assertNull(meta.builtAt());
    }

    @Test
    void getClassSummary_groupsByInstrumentClass() {
        List<ClassSummaryResponse> summary = analyticsService.getClassSummary(null, null);

        assertEquals(2, summary.size());
        ClassSummaryResponse equity = summary.get(0);
        assertEquals("EQUITY", equity.instrumentClass());
        assertEquals(2, equity.instrumentCount());
        assertEquals(5, equity.positionCount());
        assertEquals(0, equity.exposureUsd().compareTo(new BigDecimal("42000")));
        assertEquals(0, equity.averageReturn1m().compareTo(new BigDecimal("0.035")));
    }

    @Test
    void listInstruments_defaultsToLargestExposureFirst() {
        AuditPageResponse<InstrumentPerformanceResponse> page = analyticsService.listInstruments(null, null, null, null, null, null, null, null);

        assertEquals(List.of("AAPL", "MSFT", "BTC-USD"), page.content().stream().map(InstrumentPerformanceResponse::ticker).toList());
        assertEquals(3, page.totalElements());
        assertEquals(1, page.totalPages());
        assertFalse(page.hasNext());

        InstrumentPerformanceResponse aapl = page.content().get(0);
        assertEquals(AAPL, aapl.instrumentId());
        assertEquals("NASDAQ", aapl.market());
        assertEquals("USD", aapl.tradingCurrency());
        assertEquals(0, aapl.return1w().compareTo(new BigDecimal("0.01")));
        assertEquals(0, aapl.returnYtd().compareTo(new BigDecimal("0.20")));
        assertEquals(3, aapl.holderCount());
        assertEquals(0, aapl.netFlow30dUsd().compareTo(new BigDecimal("1500")));
    }

    @Test
    void listInstruments_filtersByClassAndPages() {
        AuditPageResponse<InstrumentPerformanceResponse> page = analyticsService.listInstruments(
            InstrumentClass.EQUITY, null, null, null, "ticker", "asc", 1, 1
        );

        assertEquals(List.of("MSFT"), page.content().stream().map(InstrumentPerformanceResponse::ticker).toList());
        assertEquals(2, page.totalElements());
        assertEquals(2, page.totalPages());
        assertFalse(page.hasNext());
    }

    @Test
    void listInstruments_putsMissingValuesLastWhicheverWayItSorts() {
        List<String> ascending = analyticsService.listInstruments(null, null, null, null, "return1m", "asc", null, null)
            .content().stream().map(InstrumentPerformanceResponse::ticker).toList();
        List<String> descending = analyticsService.listInstruments(null, null, null, null, "return1m", "desc", null, null)
            .content().stream().map(InstrumentPerformanceResponse::ticker).toList();

        assertEquals(List.of("MSFT", "AAPL", "BTC-USD"), ascending);
        assertEquals(List.of("AAPL", "MSFT", "BTC-USD"), descending);
    }

    @Test
    void listInstruments_rejectsUnknownSortAndDirection() {
        ValidationException badSort = assertThrows(
            ValidationException.class,
            () -> analyticsService.listInstruments(null, null, null, null, "ticker; DROP TABLE x", null, null, null)
        );
        assertTrue(badSort.getMessage().startsWith("Sort must be one of: exposure, holders"));

        assertThrows(ValidationException.class, () -> analyticsService.listInstruments(null, null, null, null, null, "sideways", null, null));
        assertThrows(ValidationException.class, () -> analyticsService.listInstruments(null, null, null, null, null, null, -1, null));
        assertThrows(ValidationException.class, () -> analyticsService.listInstruments(null, null, null, null, null, null, null, 101));
    }

    @Test
    void getInstrument_returnsOneOr404() {
        assertEquals("Apple Inc.", analyticsService.getInstrument(AAPL).name());

        assertThrows(AnalyticsNotFoundException.class, () -> analyticsService.getInstrument(UNKNOWN));
    }

    @Test
    void getInstrumentSeries_defaultsToTheLastYear() {
        List<InstrumentPricePoint> series = analyticsService.getInstrumentSeries(AAPL, null, null);

        // The 2024 row is outside the default one-year window ending on the clock's date.
        assertEquals(List.of(LocalDate.of(2026, 10, 14), LocalDate.of(2026, 10, 15), LocalDate.of(2026, 10, 16)),
            series.stream().map(InstrumentPricePoint::date).toList());
        assertNull(series.get(0).dailyReturn());
        assertEquals(0, series.get(2).cumulativeReturn().compareTo(new BigDecimal("0.0015")));
    }

    @Test
    void getInstrumentSeries_validatesRangeAndInstrument() {
        assertThrows(ValidationException.class,
            () -> analyticsService.getInstrumentSeries(AAPL, LocalDate.of(2026, 10, 16), LocalDate.of(2026, 10, 1)));
        assertThrows(ValidationException.class,
            () -> analyticsService.getInstrumentSeries(AAPL, LocalDate.of(2020, 1, 1), LocalDate.of(2026, 1, 2)));
        assertThrows(AnalyticsNotFoundException.class,
            () -> analyticsService.getInstrumentSeries(UNKNOWN, null, null));

        // Known instrument with no aggregates or prices yet: empty, not 404.
        assertTrue(analyticsService.getInstrumentSeries(EURUSD, null, null).isEmpty());
    }

    @Test
    void getClassSummary_countsOnlyTheRequestedSegment() {
        List<ClassSummaryResponse> gb = analyticsService.getClassSummary("gb", null);

        // GB 35-44 holds AAPL (10000) and BTC (5000); MSFT is still counted as an instrument, with no positions.
        ClassSummaryResponse equity = gb.get(0);
        ClassSummaryResponse crypto = gb.get(1);
        assertEquals("CRYPTO", crypto.instrumentClass());
        assertEquals(0, crypto.exposureUsd().compareTo(new BigDecimal("5000")));
        assertEquals("EQUITY", equity.instrumentClass());
        assertEquals(2, equity.instrumentCount());
        assertEquals(1, equity.positionCount());
        assertEquals(0, equity.exposureUsd().compareTo(new BigDecimal("10000")));
    }

    @Test
    void listInstruments_searchesTickerAndNameIgnoringCase() {
        List<String> byName = analyticsService.listInstruments(null, "micro", null, null, null, null, null, null)
            .content().stream().map(InstrumentPerformanceResponse::ticker).toList();
        List<String> byTicker = analyticsService.listInstruments(null, "btc", null, null, null, null, null, null)
            .content().stream().map(InstrumentPerformanceResponse::ticker).toList();
        long wildcard = analyticsService.listInstruments(null, "%", null, null, null, null, null, null).totalElements();

        assertEquals(List.of("MSFT"), byName);
        assertEquals(List.of("BTC-USD"), byTicker);
        // A literal "%" matches nothing rather than everything.
        assertEquals(0, wildcard);
    }

    @Test
    void listInstruments_segmentFiltersChangeHoldingsColumnsAndOrder() {
        AuditPageResponse<InstrumentPerformanceResponse> young = analyticsService.listInstruments(
            null, null, "US", "25-34", null, null, null, null
        );

        // Every instrument is still listed; holdings figures are the segment's, and the order follows them.
        assertEquals(List.of("AAPL", "MSFT", "BTC-USD"), young.content().stream().map(InstrumentPerformanceResponse::ticker).toList());
        InstrumentPerformanceResponse aapl = young.content().get(0);
        assertEquals(2, aapl.holderCount());
        assertEquals(0, aapl.exposureUsd().compareTo(new BigDecimal("20000")));
        assertEquals(0, aapl.netFlow30dUsd().compareTo(new BigDecimal("1000")));
        InstrumentPerformanceResponse btc = young.content().get(2);
        assertEquals(0, btc.holderCount());
        assertEquals(0, btc.exposureUsd().compareTo(BigDecimal.ZERO));
        // Returns belong to the instrument, not the segment.
        assertEquals(0, aapl.return1w().compareTo(new BigDecimal("0.01")));

        assertThrows(ValidationException.class,
            () -> analyticsService.listInstruments(null, null, null, "25–34", null, null, null, null));
    }

    @Test
    void getCountries_listsRetailCountriesWithUnknownForMissing() {
        assertEquals(List.of("GB", "US", "Unknown"), analyticsService.getCountries());
    }

    @Test
    void getSegments_groupsPortfoliosAndClassMixByAgeBand() {
        List<SegmentSummaryResponse> segments = analyticsService.getSegments("ageBand");

        assertEquals(List.of("25-34", "35-44", "unknown"), segments.stream().map(SegmentSummaryResponse::segment).toList());

        SegmentSummaryResponse young = segments.get(0);
        assertEquals(1, young.portfolioCount());
        assertEquals(0, young.marketValueUsd().compareTo(new BigDecimal("4500")));
        assertEquals(0, young.averageReturnYtd().compareTo(new BigDecimal("0.18")));
        assertEquals(1, young.classes().size());
        assertEquals("EQUITY", young.classes().get(0).instrumentClass());
        assertEquals(0, young.classes().get(0).exposureUsd().compareTo(new BigDecimal("32000")));

        SegmentSummaryResponse older = segments.get(1);
        assertEquals(List.of("EQUITY", "CRYPTO"), older.classes().stream().map(SegmentClassExposure::instrumentClass).toList());

        // No holdings yet: listed, with an empty class mix.
        assertTrue(segments.get(2).classes().isEmpty());
    }

    @Test
    void getSegments_groupsByCountryAndRejectsOtherDimensions() {
        List<String> countries = analyticsService.getSegments("country").stream().map(SegmentSummaryResponse::segment).toList();

        assertEquals(List.of("GB", "US", "Unknown"), countries);
        assertThrows(ValidationException.class, () -> analyticsService.getSegments("state"));
    }

    @Test
    void getSegmentExposure_comparesSegmentsForOneClassOrInstrument() {
        List<SegmentExposureResponse> equity = analyticsService.getSegmentExposure("ageBand", InstrumentClass.EQUITY, null);
        List<SegmentExposureResponse> bitcoin = analyticsService.getSegmentExposure("ageBand", null, BTC);

        // 25-34 holds only equities (AAPL 20000 + MSFT 12000); 35-44 splits AAPL 10000 and BTC 5000.
        assertEquals(List.of("25-34", "35-44"), equity.stream().map(SegmentExposureResponse::segment).toList());
        assertEquals(0, equity.get(0).exposureUsd().compareTo(new BigDecimal("32000")));
        assertEquals(4, equity.get(0).holderCount());
        assertEquals(0, equity.get(0).segmentTotalUsd().compareTo(new BigDecimal("32000")));
        assertEquals(0, equity.get(1).exposureUsd().compareTo(new BigDecimal("10000")));
        assertEquals(0, equity.get(1).segmentTotalUsd().compareTo(new BigDecimal("15000")));

        // A segment that doesn't hold it is still listed, with 0.
        assertEquals(0, bitcoin.get(0).exposureUsd().compareTo(BigDecimal.ZERO));
        assertEquals(0, bitcoin.get(1).exposureUsd().compareTo(new BigDecimal("5000")));

        assertThrows(ValidationException.class,
            () -> analyticsService.getSegmentExposure("ageBand", InstrumentClass.EQUITY, BTC));
        assertThrows(ValidationException.class,
            () -> analyticsService.getSegmentExposure("state", null, null));
    }

    @Test
    void listPortfolios_filtersCaseInsensitivelyByCountryAndByAgeBand() {
        AuditPageResponse<PortfolioPerformanceResponse> us = analyticsService.listPortfolios("us", null, null, null, null, null);
        AuditPageResponse<PortfolioPerformanceResponse> older = analyticsService.listPortfolios(null, "35-44", null, null, null, null);
        AuditPageResponse<PortfolioPerformanceResponse> unknown = analyticsService.listPortfolios("unknown", null, null, null, null, null);

        assertEquals(List.of(PORTFOLIO_US), us.content().stream().map(PortfolioPerformanceResponse::portfolioId).toList());
        assertEquals(List.of("GB"), older.content().stream().map(PortfolioPerformanceResponse::country).toList());
        // A missing country is reported, and can be filtered, as "Unknown".
        assertEquals(List.of("Unknown"), unknown.content().stream().map(PortfolioPerformanceResponse::country).toList());
    }

    @Test
    void listPortfolios_rejectsUnknownAgeBand() {
        ValidationException badBand = assertThrows(
            ValidationException.class,
            () -> analyticsService.listPortfolios(null, "25–34", null, null, null, null)
        );
        assertTrue(badBand.getMessage().startsWith("Age band must be one of: <25, 25-34"));
    }

    @Test
    void listPortfolios_sortsByRequestedColumn() {
        List<String> byReturn = analyticsService.listPortfolios(null, null, "returnYtd", "desc", null, null)
            .content().stream().map(PortfolioPerformanceResponse::country).toList();
        List<String> byCountry = analyticsService.listPortfolios(null, null, "country", "asc", null, null)
            .content().stream().map(PortfolioPerformanceResponse::country).toList();
        List<String> byAgeBand = analyticsService.listPortfolios(null, null, "ageBand", "desc", null, null)
            .content().stream().map(PortfolioPerformanceResponse::ageBand).toList();

        assertEquals(List.of("US", "GB", "Unknown"), byReturn);
        assertEquals(List.of("GB", "US", "Unknown"), byCountry);
        assertEquals(List.of("unknown", "35-44", "25-34"), byAgeBand);
    }

    @Test
    void getPortfolioClassSeries_addsUpOneClassPerDay() {
        List<ClassValuePoint> equity = analyticsService.getPortfolioClassSeries(PORTFOLIO_US, InstrumentClass.EQUITY, null, null);

        assertEquals(List.of(LocalDate.of(2026, 10, 15), LocalDate.of(2026, 10, 16)),
            equity.stream().map(ClassValuePoint::date).toList());
        // 15th: AAPL 3420 + MSFT 820. 16th: AAPL 3434.6, MSFT sold with 120 realized.
        assertEquals(0, equity.get(0).marketValueUsd().compareTo(new BigDecimal("4240")));
        assertEquals(0, equity.get(1).marketValueUsd().compareTo(new BigDecimal("3434.6")));
        assertEquals(0, equity.get(1).realizedPnlToDateUsd().compareTo(new BigDecimal("120")));

        assertTrue(analyticsService.getPortfolioClassSeries(PORTFOLIO_US, InstrumentClass.CRYPTO, null, null).isEmpty());
        assertThrows(ValidationException.class,
            () -> analyticsService.getPortfolioClassSeries(PORTFOLIO_US, null, null, null));
        assertThrows(AnalyticsNotFoundException.class,
            () -> analyticsService.getPortfolioClassSeries(UNKNOWN, InstrumentClass.EQUITY, null, null));
    }

    @Test
    void getPortfolioSeries_returnsDailyValues() {
        List<PortfolioValuePoint> series = analyticsService.getPortfolioSeries(PORTFOLIO_US, null, null);

        assertEquals(2, series.size());
        assertEquals(0, series.get(1).cumulativeTwr().compareTo(new BigDecimal("0.0227")));
        assertThrows(AnalyticsNotFoundException.class, () -> analyticsService.getPortfolioSeries(UNKNOWN, null, null));
    }

    @Test
    void getPortfolioHoldings_returnsOpenPositionsOnTheLatestDay() {
        List<HoldingSnapshotResponse> holdings = analyticsService.getPortfolioHoldings(PORTFOLIO_US);

        // AAPL and USD cash; MSFT was sold to 0 on the latest day.
        assertEquals(List.of("AAPL", "USD"), holdings.stream().map(HoldingSnapshotResponse::ticker).toList());
        HoldingSnapshotResponse aapl = holdings.get(0);
        assertEquals(HOLDING_AAPL, aapl.holdingId());
        assertEquals("AAPL", aapl.ticker());
        assertEquals(LocalDate.of(2026, 10, 16), aapl.asOfDate());
        assertEquals(0, aapl.unrealizedPnlUsd().compareTo(new BigDecimal("434.6")));
    }

    @Test
    void getHoldingSeries_returnsDailyValuesOr404() {
        List<HoldingValuePoint> series = analyticsService.getHoldingSeries(HOLDING_AAPL, null, null);

        assertEquals(2, series.size());
        assertEquals(0, series.get(0).marketValueUsd().compareTo(new BigDecimal("3420")));
        assertThrows(AnalyticsNotFoundException.class, () -> analyticsService.getHoldingSeries(UNKNOWN, null, null));
    }

    @Test
    void reads_reportUnavailableWhenAnalyticsIsDisabled() {
        AnalyticsService disabled = new AnalyticsService(providerOf(null), CLOCK);

        AnalyticsUnavailableException ex = assertThrows(AnalyticsUnavailableException.class, disabled::getMeta);
        assertEquals("Analytics is not enabled", ex.getMessage());
    }

    @Test
    void reads_reportUnavailableWhenTheMartsAreMissing() {
        analyticsDatabase.jdbcClient().sql("DROP TABLE analytics.agg_instrument_performance").update();

        AnalyticsUnavailableException ex = assertThrows(
            AnalyticsUnavailableException.class,
            () -> analyticsService.listInstruments(null, null, null, null, null, null, null, null)
        );
        assertEquals("Analytics data is temporarily unavailable", ex.getMessage());
    }

    private static ObjectProvider<AnalyticsDatabase> providerOf(AnalyticsDatabase database) {
        StaticListableBeanFactory beanFactory = new StaticListableBeanFactory();
        if (database != null) {
            beanFactory.addBean("analyticsDatabase", database);
        }
        return beanFactory.getBeanProvider(AnalyticsDatabase.class);
    }
}
