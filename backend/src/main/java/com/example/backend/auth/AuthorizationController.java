package com.example.backend.auth;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import com.example.backend.auth.AuthorizationService;

@RestController
public class AuthorizationController {

    private final AuthorizationService authService;

    public AuthorizationController(AuthorizationService authService) {
        this.authService = authService;
    }

    @GetMapping("/api/auth")
    public String ping() {
        return authService.ping();
    }
}