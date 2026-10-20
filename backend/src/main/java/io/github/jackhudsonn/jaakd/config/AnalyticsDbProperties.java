package io.github.jackhudsonn.jaakd.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

// Connection to the separate analytics Postgres (Lightsail today, Aurora later: only the URL changes).
@Validated
@ConfigurationProperties(prefix = "analytics.db")
public class AnalyticsDbProperties {

    private boolean enabled = false;
    private String url;
    private String username;
    private String password;

    // Kept small and separate from the main pool, so analyst traffic can never take connections trading needs.
    @Min(1)
    private int maxPoolSize = 3;

    // Enforced by the database (statement_timeout) as well as the driver.
    @NotNull
    private Duration queryTimeout = Duration.ofSeconds(5);

    // How long a request waits for a connection before analytics is reported unavailable.
    @NotNull
    private Duration connectionTimeout = Duration.ofSeconds(2);

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public int getMaxPoolSize() {
        return maxPoolSize;
    }

    public void setMaxPoolSize(int maxPoolSize) {
        this.maxPoolSize = maxPoolSize;
    }

    public Duration getQueryTimeout() {
        return queryTimeout;
    }

    public void setQueryTimeout(Duration queryTimeout) {
        this.queryTimeout = queryTimeout;
    }

    public Duration getConnectionTimeout() {
        return connectionTimeout;
    }

    public void setConnectionTimeout(Duration connectionTimeout) {
        this.connectionTimeout = connectionTimeout;
    }
}
