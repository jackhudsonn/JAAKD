package io.github.jackhudsonn.jaakd.service;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.jackhudsonn.jaakd.model.User;
import io.github.jackhudsonn.jaakd.repository.UserRepository;

@Service
public class UserProvisioner {

    private final UserRepository userRepository;
    private final WatchlistService watchlistService;
    private final Clock clock;

    public UserProvisioner(UserRepository userRepository, WatchlistService watchlistService, Clock clock) {
        this.userRepository = userRepository;
        this.watchlistService = watchlistService;
        this.clock = clock;
    }

    // Creates the application identity anchor for a verified provider user, or
    // refreshes its email when it already exists. The provider stays the source
    // of truth; this row is a projection refreshed at each sign-in.
    @Transactional
    public UUID ensureUser(UUID userId, String email) {
        UUID ensuredUserId = userRepository.findById(userId)
                .map(existing -> {
                    existing.setEmail(email);
                    return existing.getUserId();
                })
                .orElseGet(() -> userRepository.save(new User(userId, email, Instant.now(clock))).getUserId());

        watchlistService.ensureDefaultWatchlistForUser(ensuredUserId);
        return ensuredUserId;
    }
}
