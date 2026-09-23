package com.example.backend.dto;

import jakarta.validation.constraints.Size;
import java.time.LocalDate;

// Request DTO for updating a user's profile information.
// Email cannot be updated (managed by Supabase auth).
// All fields are optional (null = skip this field).
// Only size constraints are validated; null values are allowed for partial updates.
public record UpdateProfileRequest(
    @Size(min = 1, max = 100, message = "First name must be between 1 and 100 characters")
    String firstName,
    
    @Size(min = 1, max = 100, message = "Last name must be between 1 and 100 characters")
    String lastName,
    
    @Size(max = 50, message = "Username must not exceed 50 characters")
    String username,
    
    @Size(max = 100, message = "City must not exceed 100 characters")
    String city,
    
    @Size(max = 2, message = "State must be 2 characters or less")
    String state,
    
    @Size(max = 100, message = "Country must not exceed 100 characters")
    String country,
    
    @Size(max = 10, message = "Zip code must not exceed 10 characters")
    String zipCode,
    
    LocalDate dob,
    
    @Size(max = 255, message = "Avatar URL must not exceed 255 characters")
    String avatar
) {
}
