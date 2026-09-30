package io.github.jackhudsonn.jaakd.validation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.jackhudsonn.jaakd.dto.CreateProfileRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.time.LocalDate;
import java.util.Set;
import org.junit.jupiter.api.Test;

class BirthDateValidatorTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void nullDobIsValid() {
        CreateProfileRequest request = requestWithDob(null);

        Set<ConstraintViolation<CreateProfileRequest>> violations = validator.validate(request);

        assertTrue(violations.isEmpty());
    }

    @Test
    void dobIn1990IsValid() {
        CreateProfileRequest request = requestWithDob(LocalDate.of(1990, 4, 12));

        Set<ConstraintViolation<CreateProfileRequest>> violations = validator.validate(request);

        assertTrue(violations.isEmpty());
    }

    @Test
    void dobBefore1900IsInvalid() {
        CreateProfileRequest request = requestWithDob(LocalDate.of(1899, 12, 31));

        Set<ConstraintViolation<CreateProfileRequest>> violations = validator.validate(request);

        assertEquals(1, violations.size());
        assertEquals("Date of birth must be on or after 1900-01-01", violations.iterator().next().getMessage());
    }

    @Test
    void dobTenYearsAgoIsInvalid() {
        CreateProfileRequest request = requestWithDob(LocalDate.now().minusYears(10));

        Set<ConstraintViolation<CreateProfileRequest>> violations = validator.validate(request);

        assertEquals(1, violations.size());
        assertEquals("Account holders must be at least 18 years old", violations.iterator().next().getMessage());
    }

    private static CreateProfileRequest requestWithDob(LocalDate dob) {
        return new CreateProfileRequest(
                "Jane",
                "Doe",
                dob,
                "City",
                "State",
                "Country",
                "00000");
    }
}