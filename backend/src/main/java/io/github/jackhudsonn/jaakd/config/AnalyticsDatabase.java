package io.github.jackhudsonn.jaakd.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.jdbc.core.simple.JdbcClient;

// Read-only access to the analytics database. Deliberately not a DataSource bean: registering a second
// DataSource would switch off Boot's auto-configured main DataSource, and JPA with it.
public class AnalyticsDatabase implements AutoCloseable {

    private final HikariDataSource dataSource;
    private final JdbcClient jdbcClient;

    public AnalyticsDatabase(HikariDataSource dataSource) {
        this.dataSource = dataSource;
        this.jdbcClient = JdbcClient.create(dataSource);
    }

    public JdbcClient jdbcClient() {
        return jdbcClient;
    }

    @Override
    public void close() {
        dataSource.close();
    }
}
