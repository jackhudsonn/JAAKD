package com.example.backend.security;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.UUID;

// Resolves the authenticated Supabase user from the validated JWT (its `sub` claim = auth.users.id).
@Service
public class CurrentUserService {

    public UUID getUserId() {
        Jwt jwt = (Jwt) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return UUID.fromString(jwt.getSubject());
    }
}
