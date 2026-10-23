package io.github.jackhudsonn.jaakd.exception;

import io.github.jackhudsonn.jaakd.dto.ErrorResponse;
import io.github.jackhudsonn.jaakd.dto.auth.ChallengeResponse;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(UnauthorizedException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ErrorResponse handleUnauthorized(UnauthorizedException ex) {
        return new ErrorResponse(Instant.now(), ex.getMessage(), null);
    }

    @ExceptionHandler(ChallengeRequiredException.class)
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ChallengeResponse handleChallenge(ChallengeRequiredException ex) {
        return new ChallengeResponse(ex.getType(), ex.getContinuation());
    }

    @ExceptionHandler(EmailNotConfirmedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ErrorResponse handleEmailNotConfirmed(EmailNotConfirmedException ex) {
        Map<String, String> details = new LinkedHashMap<>();
        details.put("code", ApiErrorCode.EMAIL_NOT_CONFIRMED.name());
        details.put("email", ex.getEmail());

        return new ErrorResponse(Instant.now(), ex.getMessage(), details);
    }

    @ExceptionHandler(RegistrationIncompleteException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handleRegistrationIncomplete(RegistrationIncompleteException ex) {
        return new ErrorResponse(Instant.now(), ex.getMessage(), null);
    }

    @ExceptionHandler(TooManyRequestsException.class)
    @ResponseStatus(HttpStatus.TOO_MANY_REQUESTS)
    public ErrorResponse handleTooManyRequests(TooManyRequestsException ex) {
        return new ErrorResponse(Instant.now(), ex.getMessage(), null);
    }

    @ExceptionHandler(IdentityProviderUnavailableException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ErrorResponse handleIdentityProviderUnavailable(IdentityProviderUnavailableException ex) {
        log.warn("Identity provider unavailable", ex);
        return new ErrorResponse(Instant.now(), "Authentication is temporarily unavailable", null);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(ResourceNotFoundException ex) {
        return new ErrorResponse(Instant.now(), ex.getMessage(), null);
    }

    @ExceptionHandler(PortfolioNotEmptyException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handlePortfolioNotEmpty(PortfolioNotEmptyException ex) {
        Map<String, String> details = new LinkedHashMap<>();
        details.put("hasActiveOrders", Boolean.toString(ex.hasActiveOrders()));
        details.put("hasNonZeroHoldings", Boolean.toString(ex.hasNonZeroHoldings()));

        return new ErrorResponse(Instant.now(), ex.getMessage(), details);
    }

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handleEmailAlreadyRegistered(EmailAlreadyRegisteredException ex) {
        return new ErrorResponse(Instant.now(), ex.getMessage(), null);
    }

    @ExceptionHandler(ConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handleConflict(ConflictException ex) {
        return new ErrorResponse(Instant.now(), ex.getMessage(), null);
    }

    @ExceptionHandler(ValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleValidation(ValidationException ex) {
        return new ErrorResponse(Instant.now(), ex.getMessage(), null);
    }

    @ExceptionHandler(FauxnanceClientException.class)
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    public ErrorResponse handleFauxnanceClient(FauxnanceClientException ex) {
        return new ErrorResponse(Instant.now(), ex.getMessage(), null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
        Map<String, String> details = new LinkedHashMap<>();

        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            details.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
        }

        return new ErrorResponse(
                Instant.now(),
                "Validation failed",
                details
        );
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleMethodArgumentTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String name = ex.getName();
        Object value = ex.getValue();
        String message = String.format("Invalid value '%s' for parameter '%s'", value, name);

        return new ErrorResponse(Instant.now(), message, null);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleMissingRequestParameter(MissingServletRequestParameterException ex) {
        String message = String.format("Missing required parameter '%s'", ex.getParameterName());
        return new ErrorResponse(Instant.now(), message, null);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleConstraintViolation(ConstraintViolationException ex) {
        Map<String, String> details = new LinkedHashMap<>();

        for (ConstraintViolation<?> violation : ex.getConstraintViolations()) {
            details.putIfAbsent(violation.getPropertyPath().toString(), violation.getMessage());
        }

        return new ErrorResponse(
            Instant.now(),
            "Validation failed",
            details
        );
    }

    @ExceptionHandler(ForbiddenException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ErrorResponse handleForbidden(ForbiddenException ex) {
        return new ErrorResponse(Instant.now(), ex.getMessage(), null);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ErrorResponse handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled error for {} {}", request.getMethod(), request.getRequestURI(), ex);
        return new ErrorResponse(
                Instant.now(),
                "Unexpected error",
                null
        );
    }
}