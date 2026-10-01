package io.github.jackhudsonn.jaakd.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// One clock for the whole application, so timestamps are computed in one place
// (the application) rather than split across the JVM and the database, and so
// time-dependent code stays testable.
@Configuration
public class TimeConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
