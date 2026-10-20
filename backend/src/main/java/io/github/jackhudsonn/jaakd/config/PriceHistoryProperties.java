package io.github.jackhudsonn.jaakd.config;

import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.time.Period;

@Validated
@ConfigurationProperties(prefix = "prices.history")
public class PriceHistoryProperties {

    // Turns the nightly @Scheduled refresh on or off; the admin-triggered refresh works either way.
    private boolean enabled = true;

    // How far back each refresh fetches. Refetching the whole window each night keeps adjclose consistent after
    // a corporate action and replaces synthetic days. Fauxnance allows at most ten years per request.
    @NotNull
    private Period lookback = Period.ofYears(5);

    // Pause between instruments, so the refresh never uses up the quote quota that order execution relies on.
    @NotNull
    private Duration requestDelay = Duration.ofSeconds(1);

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Period getLookback() {
        return lookback;
    }

    public void setLookback(Period lookback) {
        this.lookback = lookback;
    }

    public Duration getRequestDelay() {
        return requestDelay;
    }

    public void setRequestDelay(Duration requestDelay) {
        this.requestDelay = requestDelay;
    }
}
