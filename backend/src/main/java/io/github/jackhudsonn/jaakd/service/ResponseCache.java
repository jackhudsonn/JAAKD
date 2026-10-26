package io.github.jackhudsonn.jaakd.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Caches upstream responses by their domain inputs. Fresh entries are served
 * directly; expired entries remain available as a stale fallback when the
 * loader fails. Concurrent requests for the same key share one load.
 */
final class ResponseCache<K, V> {

    private final Clock clock;
    private final ConcurrentHashMap<K, Entry<V>> entries = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<K, CompletableFuture<V>> inFlight = new ConcurrentHashMap<>();

    ResponseCache(Clock clock) {
        this.clock = clock;
    }

    CompletableFuture<V> get(
        K key,
        Duration ttl,
        Duration staleTtl,
        Supplier<CompletableFuture<V>> loader
    ) {
        Instant now = Instant.now(clock);
        Entry<V> cached = entries.get(key);

        if (cached != null && cached.isFresh(now)) {
            return CompletableFuture.completedFuture(cached.value());
        }

        CompletableFuture<V> loaded = inFlight.computeIfAbsent(key, ignored -> loader.get()
            .thenApply(value -> {
                Instant fetchedAt = Instant.now(clock);
                entries.put(key, new Entry<>(
                    value,
                    fetchedAt.plus(ttl),
                    fetchedAt.plus(ttl).plus(staleTtl)
                ));
                return value;
            })
            .exceptionallyCompose(error -> {
                Entry<V> stale = entries.get(key);
                if (stale != null && stale.isUsableStale(Instant.now(clock))) {
                    return CompletableFuture.completedFuture(stale.value());
                }
                return CompletableFuture.failedFuture(error);
            }));

        loaded.whenComplete((value, error) -> inFlight.remove(key, loaded));
        return loaded;
    }

    private record Entry<V>(V value, Instant freshUntil, Instant staleUntil) {

        boolean isFresh(Instant now) {
            return freshUntil.isAfter(now);
        }

        boolean isUsableStale(Instant now) {
            return staleUntil.isAfter(now);
        }
    }
}
