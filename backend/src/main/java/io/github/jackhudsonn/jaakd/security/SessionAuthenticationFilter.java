package io.github.jackhudsonn.jaakd.security;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import io.github.jackhudsonn.jaakd.service.SessionService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

// Resolves the opaque session cookie into an authenticated principal. The
// browser never presents a token; only this cookie identifies the caller.
public class SessionAuthenticationFilter extends OncePerRequestFilter {

    public static final String SESSION_COOKIE = "jaakd_session";

    private final SessionService sessionService;

    public SessionAuthenticationFilter(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        readSessionId(request)
                .flatMap(sessionService::resolve)
                .ifPresent(this::authenticate);

        chain.doFilter(request, response);
    }

    public static Optional<UUID> readSessionId(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }

        for (Cookie cookie : cookies) {
            if (SESSION_COOKIE.equals(cookie.getName())) {
                try {
                    return Optional.of(UUID.fromString(cookie.getValue()));
                } catch (IllegalArgumentException ex) {
                    return Optional.empty();
                }
            }
        }

        return Optional.empty();
    }

    private void authenticate(AuthenticatedUser principal) {
        var authentication = new UsernamePasswordAuthenticationToken(principal, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
