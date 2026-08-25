package com.example.backend.auth;

import org.springframework.stereotype.Service;

@Service
public class AuthorizationService {

    public String ping() {
        return "ok - auth service";
    }
}