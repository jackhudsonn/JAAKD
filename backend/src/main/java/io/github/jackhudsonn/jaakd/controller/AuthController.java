package io.github.jackhudsonn.jaakd.controller;

import java.time.Duration;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.jackhudsonn.jaakd.dto.auth.ChangePasswordRequest;
import io.github.jackhudsonn.jaakd.dto.auth.LoginRequest;
import io.github.jackhudsonn.jaakd.dto.auth.LoginResponse;
import io.github.jackhudsonn.jaakd.dto.auth.RegisterRequest;
import io.github.jackhudsonn.jaakd.model.Session;
import io.github.jackhudsonn.jaakd.security.AuthenticatedUser;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import io.github.jackhudsonn.jaakd.security.SessionAuthenticationFilter;
import io.github.jackhudsonn.jaakd.service.AuthService;
import io.github.jackhudsonn.jaakd.service.SignInResult;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

// Session auth endpoints. The caller gets an HttpOnly cookie; no route returns
// a token.
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final CurrentUserService currentUserService;
    private final Duration sessionTtl;
    private final boolean secureCookie;

    public AuthController(AuthService authService, CurrentUserService currentUserService,
            @Value("${auth.session.ttl:PT8H}") Duration sessionTtl,
            @Value("${auth.session.cookie.secure:false}") boolean secureCookie) {
        this.authService = authService;
        this.currentUserService = currentUserService;
        this.sessionTtl = sessionTtl;
        this.secureCookie = secureCookie;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public void register(@Valid @RequestBody RegisterRequest request) {
        authService.register(request.email(), request.password());
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        SignInResult result = authService.signIn(request.email(), request.password());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookie(result.session()).toString())
                .body(new LoginResponse(result.email()));
    }

    @GetMapping("/session")
    public LoginResponse session() {
        AuthenticatedUser user = currentUserService.currentUser();
        return new LoginResponse(user.email());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        SessionAuthenticationFilter.readSessionId(request).ifPresent(authService::signOut);

        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, clearedSessionCookie().toString())
                .build();
    }

    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(currentUserService.getEmail(), request.currentPassword(), request.newPassword());
    }

    private ResponseCookie sessionCookie(Session session) {
        return baseCookie(session.getSessionId().toString()).maxAge(sessionTtl).build();
    }

    private ResponseCookie clearedSessionCookie() {
        return baseCookie("").maxAge(0).build();
    }

    private ResponseCookie.ResponseCookieBuilder baseCookie(String value) {
        return ResponseCookie.from(SessionAuthenticationFilter.SESSION_COOKIE, value)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .path("/");
    }
}
