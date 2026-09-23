package com.example.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

// Response DTO for profile data.
// Provides a clean, read-only view of the profile for the client.
public record ProfileResponse(
    UUID userId,
    String email,
    BigDecimal userType,
    String firstName,
    String lastName,
    String username,
    String city,
    String state,
    String country,
    String zipCode,
    LocalDate dob,
    String avatar
) {
}
