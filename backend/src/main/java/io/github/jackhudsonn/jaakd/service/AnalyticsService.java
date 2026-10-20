package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.config.AnalyticsDatabase;
import io.github.jackhudsonn.jaakd.dto.AuditPageResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.AnalyticsMetaResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.ClassSummaryResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.HoldingSnapshotResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.HoldingValuePoint;
import io.github.jackhudsonn.jaakd.dto.analytics.InstrumentPerformanceResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.InstrumentPricePoint;
import io.github.jackhudsonn.jaakd.dto.analytics.PortfolioPerformanceResponse;
import io.github.jackhudsonn.jaakd.dto.analytics.PortfolioValuePoint;
import io.github.jackhudsonn.jaakd.exception.AnalyticsNotFoundException;
import io.github.jackhudsonn.jaakd.exception.AnalyticsUnavailableException;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.UserType;
import io.github.jackhudsonn.jaakd.security.RequiresUserType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import static java.util.Map.entry;

// Reads the analytics marts (schema "analytics") built nightly by dbt from a copy of production.
// The SQL here is the read side of the mart contract; it uses only plain Postgres so the database can move
// from Lightsail to Aurora without code changes.
@Service
@RequiresUserType({ UserType.ADMIN, UserType.ANALYST })
public class AnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsService.class);

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 25;
    private static final int MAX_SIZE = 100;
    private static final int DEFAULT_SERIES_YEARS = 1;
    private static final int MAX_SERIES_YEARS = 5;

    // Request sort keys mapped to columns. Only these strings ever reach ORDER BY.
    private static final Map<String, String> INSTRUMENT_SORTS = Map.ofEntries(
        entry("ticker", "a.ticker"),
        entry("name", "a.name"),
        entry("instrumentClass", "a.instrument_class"),
        entry("lastClose", "a.last_close_usd"),
        entry("return1w", "a.return_1w"),
        entry("return1m", "a.return_1m"),
        entry("return3m", "a.return_3m"),
        entry("returnYtd", "a.return_ytd"),
        entry("volatility", "a.volatility_ann"),
        entry("maxDrawdown", "a.max_drawdown"),
        entry("holders", "a.holder_count"),
        entry("exposure", "a.exposure_usd"),
        entry("netFlow30d", "a.net_flow_30d_usd")
    );

    private static final Map<String, String> PORTFOLIO_SORTS = Map.ofEntries(
        entry("marketValue", "p.market_value_usd"),
        entry("return1w", "p.return_1w"),
        entry("return1m", "p.return_1m"),
        entry("return3m", "p.return_3m"),
        entry("returnYtd", "p.return_ytd"),
        entry("volatility", "p.volatility_ann"),
        entry("maxDrawdown", "p.max_drawdown"),
        entry("realizedPnl", "p.realized_pnl_usd"),
        entry("unrealizedPnl", "p.unrealized_pnl_usd")
    );

    // Aliases without the underscore before digits let DataClassRowMapper match record components like return1w.
    private static final String INSTRUMENT_SELECT = """
        SELECT a.instrument_id, a.ticker, a.name, d.market, a.instrument_class, d.trading_currency,
               a.last_close_usd, a.return_1w AS return1w, a.return_1m AS return1m, a.return_3m AS return3m,
               a.return_ytd, a.volatility_ann, a.max_drawdown, a.holder_count, a.exposure_usd,
               a.net_flow_30d_usd AS net_flow30d_usd
        FROM analytics.agg_instrument_performance a
        JOIN analytics.dim_instrument d ON d.instrument_id = a.instrument_id
        """;

    private static final String PORTFOLIO_SELECT = """
        SELECT p.portfolio_id, p.user_id, p.user_type, p.country, p.age_band, p.market_value_usd,
               p.return_1w AS return1w, p.return_1m AS return1m, p.return_3m AS return3m, p.return_ytd,
               p.volatility_ann, p.max_drawdown, p.realized_pnl_usd, p.unrealized_pnl_usd
        FROM analytics.agg_portfolio_performance p
        """;

    private final ObjectProvider<AnalyticsDatabase> analyticsDatabase;
    private final Clock clock;

    public AnalyticsService(ObjectProvider<AnalyticsDatabase> analyticsDatabase, Clock clock) {
        this.analyticsDatabase = analyticsDatabase;
        this.clock = clock;
    }

    public AnalyticsMetaResponse getMeta() {
        return query(db -> db.sql("SELECT source_snapshot_at, built_at FROM analytics.meta_build")
            .query(AnalyticsMetaResponse.class)
            .optional()
            .orElse(new AnalyticsMetaResponse(null, null)));
    }

    public List<ClassSummaryResponse> getClassSummary() {
        return query(db -> db.sql("""
                SELECT instrument_class,
                       COUNT(*) AS instrument_count,
                       COALESCE(SUM(holder_count), 0) AS position_count,
                       COALESCE(SUM(exposure_usd), 0) AS exposure_usd,
                       AVG(return_1m) AS average_return1m
                FROM analytics.agg_instrument_performance
                GROUP BY instrument_class
                ORDER BY exposure_usd DESC, instrument_class
                """)
            .query(ClassSummaryResponse.class)
            .list());
    }

    public AuditPageResponse<InstrumentPerformanceResponse> listInstruments(
        InstrumentClass instrumentClass,
        String sort,
        String direction,
        Integer page,
        Integer size
    ) {
        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);
        String orderBy = orderBy(INSTRUMENT_SORTS, sort, "exposure", direction, "a.instrument_id");

        Map<String, Object> params = new LinkedHashMap<>();
        String where = "";
        if (instrumentClass != null) {
            where = " WHERE a.instrument_class = :instrumentClass";
            params.put("instrumentClass", instrumentClass.name());
        }
        String filter = where;

        return query(db -> {
            long total = db.sql("SELECT COUNT(*) FROM analytics.agg_instrument_performance a" + filter)
                .params(params)
                .query(Long.class)
                .single();

            List<InstrumentPerformanceResponse> content = db.sql(INSTRUMENT_SELECT + filter + orderBy + " LIMIT :limit OFFSET :offset")
                .params(params)
                .param("limit", resolvedSize)
                .param("offset", (long) resolvedPage * resolvedSize)
                .query(InstrumentPerformanceResponse.class)
                .list();

            return page(content, resolvedPage, resolvedSize, total);
        });
    }

    public InstrumentPerformanceResponse getInstrument(UUID instrumentId) {
        return query(db -> db.sql(INSTRUMENT_SELECT + " WHERE a.instrument_id = :instrumentId")
            .param("instrumentId", instrumentId)
            .query(InstrumentPerformanceResponse.class)
            .optional()
            .orElseThrow(() -> new AnalyticsNotFoundException("instrument", instrumentId)));
    }

    public List<InstrumentPricePoint> getInstrumentSeries(UUID instrumentId, LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);

        return query(db -> {
            requireExists(db, "SELECT COUNT(*) FROM analytics.dim_instrument WHERE instrument_id = :id", instrumentId, "instrument");

            return db.sql("""
                    SELECT price_date AS "date", close, close_usd, daily_return, cumulative_return
                    FROM analytics.fct_instrument_price_daily
                    WHERE instrument_id = :instrumentId AND price_date BETWEEN :from AND :to
                    ORDER BY price_date
                    """)
                .param("instrumentId", instrumentId)
                .param("from", range.from())
                .param("to", range.to())
                .query(InstrumentPricePoint.class)
                .list();
        });
    }

    public AuditPageResponse<PortfolioPerformanceResponse> listPortfolios(
        String country,
        String ageBand,
        Integer userType,
        String sort,
        String direction,
        Integer page,
        Integer size
    ) {
        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);
        String orderBy = orderBy(PORTFOLIO_SORTS, sort, "marketValue", direction, "p.portfolio_id");

        Map<String, Object> params = new LinkedHashMap<>();
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        if (country != null && !country.isBlank()) {
            where.append(" AND UPPER(p.country) = UPPER(:country)");
            params.put("country", country.trim());
        }
        if (ageBand != null && !ageBand.isBlank()) {
            where.append(" AND p.age_band = :ageBand");
            params.put("ageBand", ageBand.trim());
        }
        if (userType != null) {
            where.append(" AND p.user_type = :userType");
            params.put("userType", userType);
        }
        String filter = where.toString();

        return query(db -> {
            long total = db.sql("SELECT COUNT(*) FROM analytics.agg_portfolio_performance p" + filter)
                .params(params)
                .query(Long.class)
                .single();

            List<PortfolioPerformanceResponse> content = db.sql(PORTFOLIO_SELECT + filter + orderBy + " LIMIT :limit OFFSET :offset")
                .params(params)
                .param("limit", resolvedSize)
                .param("offset", (long) resolvedPage * resolvedSize)
                .query(PortfolioPerformanceResponse.class)
                .list();

            return page(content, resolvedPage, resolvedSize, total);
        });
    }

    public PortfolioPerformanceResponse getPortfolio(UUID portfolioId) {
        return query(db -> db.sql(PORTFOLIO_SELECT + " WHERE p.portfolio_id = :portfolioId")
            .param("portfolioId", portfolioId)
            .query(PortfolioPerformanceResponse.class)
            .optional()
            .orElseThrow(() -> new AnalyticsNotFoundException("portfolio", portfolioId)));
    }

    public List<PortfolioValuePoint> getPortfolioSeries(UUID portfolioId, LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);

        return query(db -> {
            requireExists(db, "SELECT COUNT(*) FROM analytics.dim_portfolio WHERE portfolio_id = :id", portfolioId, "portfolio");

            return db.sql("""
                    SELECT as_of_date AS "date", market_value_usd, cash_usd, net_external_flow_usd,
                           daily_return, cumulative_twr
                    FROM analytics.fct_portfolio_daily
                    WHERE portfolio_id = :portfolioId AND as_of_date BETWEEN :from AND :to
                    ORDER BY as_of_date
                    """)
                .param("portfolioId", portfolioId)
                .param("from", range.from())
                .param("to", range.to())
                .query(PortfolioValuePoint.class)
                .list();
        });
    }

    // Open positions on the portfolio's latest built day.
    public List<HoldingSnapshotResponse> getPortfolioHoldings(UUID portfolioId) {
        return query(db -> {
            requireExists(db, "SELECT COUNT(*) FROM analytics.dim_portfolio WHERE portfolio_id = :id", portfolioId, "portfolio");

            return db.sql("""
                    SELECT h.holding_id, h.instrument_id, i.ticker, i.name, i.instrument_class, h.as_of_date,
                           h.quantity, h.cost_basis_usd, h.market_value_usd, h.realized_pnl_to_date_usd,
                           h.unrealized_pnl_usd
                    FROM analytics.fct_holding_daily h
                    JOIN analytics.dim_instrument i ON i.instrument_id = h.instrument_id
                    WHERE h.portfolio_id = :portfolioId
                      AND h.quantity <> 0
                      AND h.as_of_date = (
                          SELECT MAX(latest.as_of_date)
                          FROM analytics.fct_holding_daily latest
                          WHERE latest.portfolio_id = :portfolioId
                      )
                    ORDER BY h.market_value_usd DESC NULLS LAST, i.ticker
                    """)
                .param("portfolioId", portfolioId)
                .query(HoldingSnapshotResponse.class)
                .list();
        });
    }

    public List<HoldingValuePoint> getHoldingSeries(UUID holdingId, LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);

        return query(db -> {
            requireExists(db, "SELECT COUNT(*) FROM analytics.fct_holding_daily WHERE holding_id = :id", holdingId, "holding");

            return db.sql("""
                    SELECT as_of_date AS "date", quantity, cost_basis_usd, market_value_usd,
                           realized_pnl_to_date_usd, unrealized_pnl_usd
                    FROM analytics.fct_holding_daily
                    WHERE holding_id = :holdingId AND as_of_date BETWEEN :from AND :to
                    ORDER BY as_of_date
                    """)
                .param("holdingId", holdingId)
                .param("from", range.from())
                .param("to", range.to())
                .query(HoldingValuePoint.class)
                .list();
        });
    }

    // Every read goes through here: no database configured, or any database error, means 503 rather than 500.
    private <T> T query(Function<JdbcClient, T> work) {
        AnalyticsDatabase database = analyticsDatabase.getIfAvailable();
        if (database == null) {
            throw new AnalyticsUnavailableException("Analytics is not enabled");
        }

        try {
            return work.apply(database.jdbcClient());
        } catch (DataAccessException ex) {
            log.warn("Analytics query failed: {}", ex.getMessage());
            throw new AnalyticsUnavailableException("Analytics data is temporarily unavailable", ex);
        }
    }

    private static void requireExists(JdbcClient db, String countSql, UUID id, String resource) {
        long count = db.sql(countSql).param("id", id).query(Long.class).single();
        if (count == 0) {
            throw new AnalyticsNotFoundException(resource, id);
        }
    }

    private static String orderBy(
        Map<String, String> allowedSorts,
        String sort,
        String defaultSort,
        String direction,
        String tieBreaker
    ) {
        String sortKey = sort == null || sort.isBlank() ? defaultSort : sort.trim();
        String column = allowedSorts.get(sortKey);
        if (column == null) {
            throw new ValidationException(
                "Sort must be one of: " + String.join(", ", allowedSorts.keySet().stream().sorted().toList())
            );
        }

        String resolvedDirection;
        if (direction == null || direction.isBlank() || direction.equalsIgnoreCase("desc")) {
            resolvedDirection = "DESC";
        } else if (direction.equalsIgnoreCase("asc")) {
            resolvedDirection = "ASC";
        } else {
            throw new ValidationException("Direction must be asc or desc");
        }

        return " ORDER BY " + column + " " + resolvedDirection + " NULLS LAST, " + tieBreaker;
    }

    private DateRange resolveRange(LocalDate from, LocalDate to) {
        LocalDate resolvedTo = to == null ? LocalDate.now(clock) : to;
        LocalDate resolvedFrom = from == null ? resolvedTo.minusYears(DEFAULT_SERIES_YEARS) : from;

        if (resolvedFrom.isAfter(resolvedTo)) {
            throw new ValidationException("from must be on or before to");
        }
        if (resolvedFrom.plusYears(MAX_SERIES_YEARS).isBefore(resolvedTo)) {
            throw new ValidationException("Date range must be " + MAX_SERIES_YEARS + " years or less");
        }

        return new DateRange(resolvedFrom, resolvedTo);
    }

    private static void validatePaging(int page, int size) {
        if (page < 0) {
            throw new ValidationException("Page must be greater than or equal to 0");
        }

        if (size < 1 || size > MAX_SIZE) {
            throw new ValidationException("Size must be between 1 and 100");
        }
    }

    private static <T> AuditPageResponse<T> page(List<T> content, int page, int size, long total) {
        int totalPages = (int) ((total + size - 1) / size);
        boolean hasNext = (long) (page + 1) * size < total;
        return new AuditPageResponse<>(content, page, size, total, totalPages, hasNext);
    }

    private record DateRange(LocalDate from, LocalDate to) {
    }
}
