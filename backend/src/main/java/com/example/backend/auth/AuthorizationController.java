package com.example.backend.auth;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthorizationController {

    @GetMapping("/api/auth")
    public String ping() {
        return "ok - auth";
    }
}