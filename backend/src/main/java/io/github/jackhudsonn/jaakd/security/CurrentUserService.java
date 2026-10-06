package io.github.jackhudsonn.jaakd.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import io.github.jackhudsonn.jaakd.exception.UnauthorizedException;

import java.util.UUID;

// Resolves the authenticated user from the session principal.
@Service
public class CurrentUserService {

    // Protected routes always carry a session principal. These checks turn any
    // other caller (no security context on this thread, or Spring's anonymous
    // or foreign principal) into a 401 instead of a cast failure.
    public AuthenticatedUser currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
            throw new UnauthorizedException("no authenticated user");
        }

        return user;
    }

    public UUID getUserId() {
        return currentUser().userId();
    }

    public String getEmail() {
        return currentUser().email();
    }
}
