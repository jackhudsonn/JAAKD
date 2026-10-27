package io.github.jackhudsonn.jaakd.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(AnalyticsDbProperties.class)
public class AnalyticsDbConfig {

    // Only created when analytics.db.enabled=true; without it the analytics endpoints answer 503.
    @Bean(destroyMethod = "close")
    @ConditionalOnProperty(prefix = "analytics.db", name = "enabled", havingValue = "true")
    public AnalyticsDatabase analyticsDatabase(AnalyticsDbProperties properties) {
        HikariConfig config = new HikariConfig();
        config.setPoolName("analytics");
        config.setJdbcUrl(properties.getUrl());
        config.setUsername(properties.getUsername());
        config.setPassword(properties.getPassword());
        config.setReadOnly(true);
        config.setMaximumPoolSize(properties.getMaxPoolSize());
        config.setMinimumIdle(0);
        config.setConnectionTimeout(properties.getConnectionTimeout().toMillis());
        config.setConnectionInitSql("SET statement_timeout = " + properties.getQueryTimeout().toMillis());
        config.addDataSourceProperty("ApplicationName", "jaakd-analytics");
        // Start even if the analytics database is down; trading must never depend on it.
        config.setInitializationFailTimeout(-1);

        return new AnalyticsDatabase(new HikariDataSource(config));
    }
}
