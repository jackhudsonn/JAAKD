package io.github.jackhudsonn.jaakd.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

class ResponseCacheTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
    private final ResponseCache<String, String> cache = new ResponseCache<>(clock);

    @Test
    void servesFreshEntryWithoutLoadingAgain() {
        AtomicInteger loads = new AtomicInteger();

        String first = cache.get("key", Duration.ofSeconds(60), Duration.ofMinutes(5), () -> {
            loads.incrementAndGet();
            return CompletableFuture.completedFuture("value");
        }).join();

        String second = cache.get("key", Duration.ofSeconds(60), Duration.ofMinutes(5), () -> {
            loads.incrementAndGet();
            return CompletableFuture.completedFuture("other");
        }).join();

        assertEquals("value", first);
        assertEquals("value", second);
        assertEquals(1, loads.get());
    }

    @Test
    void reloadsAfterTtlExpires() {
        AtomicInteger loads = new AtomicInteger();
        cache.get("key", Duration.ofSeconds(60), Duration.ofMinutes(5), () -> {
            loads.incrementAndGet();
            return CompletableFuture.completedFuture("first");
        }).join();

        clock.advance(Duration.ofSeconds(61));

        String second = cache.get("key", Duration.ofSeconds(60), Duration.ofMinutes(5), () -> {
            loads.incrementAndGet();
            return CompletableFuture.completedFuture("second");
        }).join();

        assertEquals("second", second);
        assertEquals(2, loads.get());
    }

    @Test
    void servesStaleEntryWhenLoaderFails() {
        cache.get("key", Duration.ofSeconds(60), Duration.ofMinutes(5), () ->
            CompletableFuture.completedFuture("stale")
        ).join();

        clock.advance(Duration.ofSeconds(61));

        String result = cache.get("key", Duration.ofSeconds(60), Duration.ofMinutes(5), () ->
            CompletableFuture.failedFuture(new IllegalStateException("upstream unavailable"))
        ).join();

        assertEquals("stale", result);
    }

    @Test
    void concurrentRequestsShareOneLoad() {
        AtomicInteger loads = new AtomicInteger();
        CompletableFuture<String> pending = new CompletableFuture<>();
        java.util.function.Supplier<CompletableFuture<String>> loader = () -> {
            loads.incrementAndGet();
            return pending;
        };

        CompletableFuture<String> first = cache.get("key", Duration.ofSeconds(60), Duration.ofMinutes(5), loader);
        CompletableFuture<String> second = cache.get("key", Duration.ofSeconds(60), Duration.ofMinutes(5), loader);

        assertSame(first, second);
        assertEquals(1, loads.get());

        pending.complete("value");
        assertEquals("value", first.join());
        assertEquals("value", second.join());
    }

    private static final class MutableClock extends Clock {

        private Instant now;

        private MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
