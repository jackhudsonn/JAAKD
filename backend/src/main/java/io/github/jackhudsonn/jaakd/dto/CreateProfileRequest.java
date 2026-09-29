package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record CreateProfileRequest(
    @NotBlank(message = "First name is required")
    @Size(min = 1, max = 100, message = "First name must be between 1 and 100 characters")
    String firstName,

    @NotBlank(message = "Last name is required")
    @Size(min = 1, max = 100, message = "Last name must be between 1 and 100 characters")
    String lastName,

    LocalDate dob,

    @Size(max = 100, message = "City must not exceed 100 characters")
    String city,

    @Size(max = 2, message = "State must be 2 characters or less")
    String state,

    @Size(max = 100, message = "Country must not exceed 100 characters")
    String country,

    @Size(max = 10, message = "Zip code must not exceed 10 characters")
    String zipCode
) {
}
