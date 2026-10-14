package io.github.jackhudsonn.jaakd.exception;

import io.github.jackhudsonn.jaakd.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DataAccessException;
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
    public ErrorResponse handleChallenge(ChallengeRequiredException ex) {
        Map<String, String> details = new LinkedHashMap<>();
        details.put("challenge", ex.getType());
        details.put("continuation", ex.getContinuation());

        return new ErrorResponse(Instant.now(), ex.getMessage(), details);
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

    @ExceptionHandler(DataAccessException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ErrorResponse handleDataAccess(DataAccessException ex) {
        log.error("Database access error", ex);

        Throwable root = ex.getMostSpecificCause();
        String rootMessage = root == null ? "unknown" : String.valueOf(root.getMessage());
        String normalized = rootMessage.toLowerCase();

        String errorType = "db_unknown";
        String hint = "Check backend datasource environment variables and database reachability from the backend host.";

        if (normalized.contains("password authentication failed") || normalized.contains("authentication failed")) {
            errorType = "db_auth";
            hint = "Database authentication failed. Verify datasource username and password on the backend host.";
        } else if (normalized.contains("connection refused") || normalized.contains("connect timed out") || normalized.contains("timeout") || normalized.contains("could not connect")) {
            errorType = "db_connectivity";
            hint = "Backend cannot reach the database host/port. Verify network, host, and port from the backend runtime.";
        } else if (normalized.contains("illegal path") || normalized.contains("can't add file system") || normalized.contains("cannot add file system")) {
            errorType = "db_path_config";
            hint = "Datasource/JDBC path config is invalid for this OS. Check backend-side JDBC URL options such as ssl cert paths.";
        }

        Map<String, String> details = new LinkedHashMap<>();
        details.put("type", errorType);
        details.put("hint", hint);

        return new ErrorResponse(Instant.now(), "Database error", details);
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