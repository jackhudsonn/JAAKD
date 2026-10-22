package io.github.jackhudsonn.jaakd.identity.cognito;

import org.springframework.stereotype.Component;

import io.github.jackhudsonn.jaakd.exception.EmailAlreadyRegisteredException;
import io.github.jackhudsonn.jaakd.exception.EmailNotConfirmedException;
import io.github.jackhudsonn.jaakd.exception.ForbiddenException;
import io.github.jackhudsonn.jaakd.exception.IdentityProviderUnavailableException;
import io.github.jackhudsonn.jaakd.exception.TooManyRequestsException;
import io.github.jackhudsonn.jaakd.exception.UnauthorizedException;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.cognitoidentityprovider.model.CognitoIdentityProviderException;

// Maps Cognito/SDK failures to the application's existing error model so the
// core never sees provider-specific exceptions.
@Component
public class CognitoExceptionTranslator {

    public RuntimeException translate(SdkException ex, String email) {
        if (!(ex instanceof CognitoIdentityProviderException providerException)) {
            return new IdentityProviderUnavailableException("identity provider unavailable", ex);
        }

        String code = errorCode(providerException);
        return switch (code) {
            case "NotAuthorizedException", "UserNotFoundException" ->
                    new UnauthorizedException("invalid email or password");
            case "UserNotConfirmedException" -> new EmailNotConfirmedException(email);
            case "PasswordResetRequiredException" -> new ForbiddenException("password reset required");
            case "InvalidPasswordException" ->
                    new ValidationException("password is not strong enough");
            case "CodeMismatchException", "ExpiredCodeException" ->
                    new ValidationException("invalid or expired verification code");
            case "AliasExistsException", "UsernameExistsException" ->
                    new EmailAlreadyRegisteredException();
            case "TooManyRequestsException", "LimitExceededException" ->
                    new TooManyRequestsException("too many authentication requests; try again later");
            case "InvalidParameterException" -> new ValidationException("invalid registration details");
            default -> new IdentityProviderUnavailableException("identity provider unavailable", ex);
        };
    }

    public String errorCode(CognitoIdentityProviderException ex) {
        if (ex.awsErrorDetails() != null && ex.awsErrorDetails().errorCode() != null
                && !ex.awsErrorDetails().errorCode().isBlank()) {
            return ex.awsErrorDetails().errorCode();
        }
        // Mocked and some SDK-thrown exceptions have no error details; the
        // exception type carries the same name as the Cognito error code.
        return ex.getClass().getSimpleName();
    }
}
