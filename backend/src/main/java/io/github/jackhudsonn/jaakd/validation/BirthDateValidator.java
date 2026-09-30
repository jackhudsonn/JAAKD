package io.github.jackhudsonn.jaakd.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.time.LocalDate;

public class BirthDateValidator implements ConstraintValidator<ValidBirthDate, LocalDate> {

    private static final LocalDate MIN_DOB = LocalDate.of(1900, 1, 1);

    @Override
    public boolean isValid(LocalDate value, ConstraintValidatorContext context) {
        if (value == null) {
            return true;
        }

        if (value.isBefore(MIN_DOB)) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate("Date of birth must be on or after 1900-01-01")
                    .addConstraintViolation();
            return false;
        }

        LocalDate youngestAllowed = LocalDate.now().minusYears(18);
        if (value.isAfter(youngestAllowed)) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate("Account holders must be at least 18 years old")
                    .addConstraintViolation();
            return false;
        }

        return true;
    }
}