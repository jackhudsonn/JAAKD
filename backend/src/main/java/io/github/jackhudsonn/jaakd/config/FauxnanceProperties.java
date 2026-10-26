package io.github.jackhudsonn.jaakd.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

@ConfigurationProperties(prefix = "fauxnance")
public class FauxnanceProperties {

    private String baseUrl;
    private String apiKey;
    private String apiKeyHeader = "X-API-Key";

    @Valid
    @NotNull
    private Timeout timeout = new Timeout();

    @Valid
    @NotNull
    private Retry retry = new Retry();

    @Valid
    @NotNull
    private Quotes quotes = new Quotes();

    @Valid
    @NotNull
    private Cache cache = new Cache();

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getApiKeyHeader() {
        return apiKeyHeader;
    }

    public void setApiKeyHeader(String apiKeyHeader) {
        this.apiKeyHeader = apiKeyHeader;
    }

    public Timeout getTimeout() {
        return timeout;
    }

    public void setTimeout(Timeout timeout) {
        this.timeout = timeout;
    }

    public Retry getRetry() {
        return retry;
    }

    public void setRetry(Retry retry) {
        this.retry = retry;
    }

    public Quotes getQuotes() {
        return quotes;
    }

    public void setQuotes(Quotes quotes) {
        this.quotes = quotes;
    }

    public Cache getCache() {
        return cache;
    }

    public void setCache(Cache cache) {
        this.cache = cache;
    }

    public static class Timeout {
        @NotNull
        private Duration connect = Duration.ofSeconds(2);

        @NotNull
        private Duration read = Duration.ofSeconds(4);

        public Duration getConnect() {
            return connect;
        }

        public void setConnect(Duration connect) {
            this.connect = connect;
        }

        public Duration getRead() {
            return read;
        }

        public void setRead(Duration read) {
            this.read = read;
        }
    }

    public static class Retry {
        @Min(1)
        private int maxAttempts = 3;

        @NotNull
        private Duration backoff = Duration.ofMillis(200);

        public int getMaxAttempts() {
            return maxAttempts;
        }

        public void setMaxAttempts(int maxAttempts) {
            this.maxAttempts = maxAttempts;
        }

        public Duration getBackoff() {
            return backoff;
        }

        public void setBackoff(Duration backoff) {
            this.backoff = backoff;
        }
    }

    public static class Quotes {
        @Min(1)
        private int maxBatchSize = 25;

        public int getMaxBatchSize() {
            return maxBatchSize;
        }

        public void setMaxBatchSize(int maxBatchSize) {
            this.maxBatchSize = maxBatchSize;
        }
    }

    public static class Cache {
        @NotNull
        private Duration quoteTtl = Duration.ofMinutes(15);

        @NotNull
        private Duration symbolTtl = Duration.ofMinutes(15);

        @NotNull
        private Duration candleTtl = Duration.ofMinutes(1);

        @NotNull
        private Duration staleTtl = Duration.ofMinutes(15);

        public Duration getQuoteTtl() {
            return quoteTtl;
        }

        public void setQuoteTtl(Duration quoteTtl) {
            this.quoteTtl = quoteTtl;
        }

        public Duration getSymbolTtl() {
            return symbolTtl;
        }

        public void setSymbolTtl(Duration symbolTtl) {
            this.symbolTtl = symbolTtl;
        }

        public Duration getCandleTtl() {
            return candleTtl;
        }

        public void setCandleTtl(Duration candleTtl) {
            this.candleTtl = candleTtl;
        }

        public Duration getStaleTtl() {
            return staleTtl;
        }

        public void setStaleTtl(Duration staleTtl) {
            this.staleTtl = staleTtl;
        }
    }
}
