package io.github.jackhudsonn.jaakd.security;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.UUID;

// Resolves the authenticated user from the validated JWT (its `sub` claim = profile owner UUID).
@Service
public class CurrentUserService {
    public static final String EMAIL_CLAIM = "email";

    public UUID getUserId() {
        return UUID.fromString(currentJwt().getSubject());
    }

    public String getEmail() {
        return currentJwt().getClaimAsString(EMAIL_CLAIM);
    }

    private Jwt currentJwt() {
        return (Jwt) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
