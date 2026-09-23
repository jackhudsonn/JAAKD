package io.github.jackhudsonn.jaakd.exception;

import java.util.UUID;

public class ProfileNotFoundException extends ResourceNotFoundException {

    public ProfileNotFoundException(UUID userId) {
        super("Profile not found for user: " + userId);
    }
}