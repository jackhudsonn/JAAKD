package io.github.jackhudsonn.jaakd.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableConfigurationProperties(PriceHistoryProperties.class)
public class PriceHistoryConfig {

    // Scheduling is only switched on when the nightly refresh is enabled (tests turn it off).
    @Configuration
    @EnableScheduling
    @ConditionalOnProperty(prefix = "prices.history", name = "enabled", havingValue = "true", matchIfMissing = true)
    static class Scheduling {
    }
}
