package io.github.jackhudsonn.jaakd.identity.cognito;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import io.github.jackhudsonn.jaakd.config.CognitoProperties;
import io.github.jackhudsonn.jaakd.exception.ChallengeRequiredException;
import io.github.jackhudsonn.jaakd.exception.ConflictException;
import io.github.jackhudsonn.jaakd.exception.EmailNotConfirmedException;
import io.github.jackhudsonn.jaakd.exception.IdentityProviderUnavailableException;
import io.github.jackhudsonn.jaakd.exception.RegistrationIncompleteException;
import io.github.jackhudsonn.jaakd.exception.UnauthorizedException;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
import io.github.jackhudsonn.jaakd.identity.IdentityProvider;
import io.github.jackhudsonn.jaakd.identity.RegistrationOutcome;
import io.github.jackhudsonn.jaakd.identity.SignInOutcome;
import io.github.jackhudsonn.jaakd.identity.cognito.CognitoIdTokenVerifier.CognitoIdentity;
import io.github.jackhudsonn.jaakd.identity.cognito.CognitoUserStore.CognitoUser;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AttributeType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AuthFlowType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.CognitoIdentityProviderException;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AuthenticationResultType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ChangePasswordRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ConfirmSignUpRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ConfirmSignUpResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.InitiateAuthRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.InitiateAuthResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ResendConfirmationCodeRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.RevokeTokenRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.SignUpRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.SignUpResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.UsernameExistsException;

// Backend-mediated Cognito adapter. The application owns users and sessions;
// this adapter verifies credentials, owns the subject-to-user link, and
// revokes provider refresh tokens when the application ends a session.
@Component
@ConditionalOnProperty(name = "identity.provider", havingValue = "cognito")
public class CognitoIdentityProvider implements IdentityProvider {

    private static final Logger log = LoggerFactory.getLogger(CognitoIdentityProvider.class);

    private final CognitoIdentityProviderClient client;
    private final CognitoProperties properties;
    private final CognitoIdTokenVerifier idTokenVerifier;
    private final CognitoUserStore userStore;
    private final CognitoExceptionTranslator exceptions;

    public CognitoIdentityProvider(CognitoIdentityProviderClient client, CognitoProperties properties,
            CognitoIdTokenVerifier idTokenVerifier, CognitoUserStore userStore,
            CognitoExceptionTranslator exceptions) {
        this.client = client;
        this.properties = properties;
        this.idTokenVerifier = idTokenVerifier;
        this.userStore = userStore;
        this.exceptions = exceptions;
    }

    @Override
    public RegistrationOutcome register(UUID userId, String email, String password) {
        String normalized = normalize(email);
        if (userStore.findConfirmedByEmail(normalized).isPresent()) {
            throw new ConflictException("email already registered");
        }

        String username = userId.toString();
        SignUpRequest.Builder request = SignUpRequest.builder()
                .clientId(properties.getClientId())
                .username(username)
                .password(password)
                .userAttributes(AttributeType.builder().name("email").value(normalized).build());
        if (properties.hasClientSecret()) {
            request.secretHash(secretHash(username));
        }

        try {
            SignUpResponse response = client.signUp(request.build());
            if (response.userSub() == null || response.userSub().isBlank()) {
                throw new IdentityProviderUnavailableException("Cognito SignUp returned no subject");
            }
            return new RegistrationOutcome(response.userSub(), !Boolean.TRUE.equals(response.userConfirmed()),
                    response.session());
        } catch (UsernameExistsException ex) {
            throw new ConflictException("registration already exists");
        } catch (SdkException ex) {
            throw exceptions.translate(ex, normalized);
        }
    }

    @Override
    public void link(UUID userId, String subject, String signUpSession) {
        userStore.insertPending(userId, subject, signUpSession);
    }

    @Override
    public Optional<SignInOutcome.Authenticated> confirmRegistration(UUID registrationId, String code) {
        String username = registrationId.toString();
        CognitoUser pending = userStore.findByUserId(registrationId)
                .orElseThrow(() -> new ValidationException("no pending registration for this registration id"));
        if (!"PENDING".equals(pending.status())) {
            throw new ValidationException("email is already confirmed");
        }

        ConfirmSignUpRequest.Builder request = ConfirmSignUpRequest.builder()
                .clientId(properties.getClientId())
                .username(username)
                .confirmationCode(code)
                .forceAliasCreation(true);
        if (pending.signUpSession() != null && !pending.signUpSession().isBlank()) {
            request.session(pending.signUpSession());
        }
        if (properties.hasClientSecret()) {
            request.secretHash(secretHash(username));
        }

        ConfirmSignUpResponse response;
        try {
            response = confirmSignUp(request, pending);
            userStore.markConfirmed(pending.identityId());
        } catch (CognitoIdentityProviderException ex) {
            if (isNotAuthorizedOrMissing(ex)) {
                throw new ValidationException("email is already confirmed or the code is invalid");
            }
            throw exceptions.translate(ex, username);
        } catch (SdkException ex) {
            throw exceptions.translate(ex, username);
        }

        return signInAfterConfirmation(username, response.session());
    }

    private ConfirmSignUpResponse confirmSignUp(ConfirmSignUpRequest.Builder request, CognitoUser pending) {
        try {
            return client.confirmSignUp(request.build());
        } catch (CognitoIdentityProviderException ex) {
            String code = exceptions.errorCode(ex);
            boolean sessionFailure = "NotAuthorizedException".equals(code)
                    || "InvalidParameterException".equals(code);
            if (sessionFailure && pending.signUpSession() != null && !pending.signUpSession().isBlank()) {
                // The SignUp session is short-lived. Retry without it so a valid
                // confirmation code can still confirm the account; automatic
                // sign-in then falls back to the normal login page.
                request.session(null);
                return client.confirmSignUp(request.build());
            }
            throw ex;
        }
    }

    @Override
    public void resendConfirmation(UUID registrationId) {
        String username = registrationId.toString();
        CognitoUser pending = userStore.findByUserId(registrationId)
                .orElseThrow(() -> new ValidationException("no pending registration for this registration id"));
        if (!"PENDING".equals(pending.status())) {
            throw new ValidationException("email is already confirmed");
        }

        ResendConfirmationCodeRequest.Builder request = ResendConfirmationCodeRequest.builder()
                .clientId(properties.getClientId())
                .username(username);
        if (properties.hasClientSecret()) {
            request.secretHash(secretHash(username));
        }

        try {
            client.resendConfirmationCode(request.build());
        } catch (CognitoIdentityProviderException ex) {
            if (isNotAuthorizedOrMissing(ex)) {
                throw new ValidationException("email is already confirmed or has no pending registration");
            }
            throw exceptions.translate(ex, username);
        } catch (SdkException ex) {
            throw exceptions.translate(ex, username);
        }
    }

    private Optional<SignInOutcome.Authenticated> signInAfterConfirmation(String username, String session) {
        if (session == null || session.isBlank()) {
            return Optional.empty();
        }

        Map<String, String> parameters = new HashMap<>();
        parameters.put("USERNAME", username);
        if (properties.hasClientSecret()) {
            parameters.put("SECRET_HASH", secretHash(username));
        }

        try {
            InitiateAuthResponse response = client.initiateAuth(InitiateAuthRequest.builder()
                    .clientId(properties.getClientId())
                    .authFlow(AuthFlowType.USER_AUTH)
                    .session(session)
                    .authParameters(parameters)
                    .build());

            AuthenticationResultType result = response.authenticationResult();
            if (result == null || result.idToken() == null) {
                log.warn("Cognito confirmation did not return an authentication result");
                return Optional.empty();
            }

            CognitoIdentity identity = idTokenVerifier.verify(result.idToken());
            CognitoUser user = userStore.findBySubject(identity.subject())
                    .orElseThrow(RegistrationIncompleteException::new);
            userStore.markConfirmed(identity.subject());
            return Optional.of(new SignInOutcome.Authenticated(user.userId(), identity.email(), result.refreshToken()));
        } catch (RuntimeException ex) {
            // Confirmation already succeeded. A failed automatic sign-in must
            // not turn a successful confirmation into an error; the client
            // falls back to the login page.
            log.warn("Cognito automatic sign-in after confirmation failed: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    private boolean isNotAuthorizedOrMissing(CognitoIdentityProviderException ex) {
        String code = exceptions.errorCode(ex);
        return "NotAuthorizedException".equals(code) || "UserNotFoundException".equals(code);
    }

    @Override
    public SignInOutcome signIn(String email, String password) {
        String normalized = normalize(email);
        InitiateAuthResponse response;
        try {
            response = initiateAuth(normalized, password);
        } catch (UnauthorizedException ex) {
            if (userStore.findConfirmedByEmail(normalized).isEmpty()
                    && userStore.findLatestPendingByEmail(normalized).isPresent()) {
                throw new EmailNotConfirmedException(normalized);
            }
            throw ex;
        }

        if (response.challengeName() != null && response.authenticationResult() == null) {
            throw new ChallengeRequiredException(response.session(), response.challengeNameAsString());
        }

        AuthenticationResultType result = response.authenticationResult();
        if (result == null || result.idToken() == null) {
            throw new UnauthorizedException("invalid email or password");
        }

        CognitoIdentity identity = idTokenVerifier.verify(result.idToken());
        CognitoUser user = userStore.findBySubject(identity.subject())
                .orElseThrow(RegistrationIncompleteException::new);

        userStore.markConfirmed(identity.subject());

        return new SignInOutcome.Authenticated(user.userId(), identity.email(), result.refreshToken());
    }

    @Override
    public void changePassword(String email, String currentPassword, String newPassword) {
        String normalized = normalize(email);
        AuthenticationResultType authentication = authenticateForPasswordChange(normalized, currentPassword);

        try {
            client.changePassword(ChangePasswordRequest.builder()
                    .accessToken(authentication.accessToken())
                    .previousPassword(currentPassword)
                    .proposedPassword(newPassword)
                    .build());
        } catch (SdkException ex) {
            throw exceptions.translate(ex, normalized);
        } finally {
            revoke(authentication.refreshToken());
        }
    }

    @Override
    public void revoke(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }

        RevokeTokenRequest.Builder request = RevokeTokenRequest.builder()
                .clientId(properties.getClientId())
                .token(refreshToken);
        if (properties.hasClientSecret()) {
            request.clientSecret(properties.getClientSecret());
        }

        try {
            client.revokeToken(request.build());
        } catch (SdkException ex) {
            // Logout and password change must not fail because revocation did.
            log.warn("Cognito token revocation failed: {}", ex.getMessage());
        }
    }

    private AuthenticationResultType authenticateForPasswordChange(String email, String currentPassword) {
        InitiateAuthResponse response = initiateAuth(email, currentPassword);

        if (response.challengeName() != null && response.authenticationResult() == null) {
            throw new ChallengeRequiredException(response.session(), response.challengeNameAsString());
        }

        AuthenticationResultType result = response.authenticationResult();
        if (result == null || result.accessToken() == null) {
            throw new UnauthorizedException("invalid email or password");
        }
        return result;
    }

    private InitiateAuthResponse initiateAuth(String email, String password) {
        Map<String, String> parameters = new HashMap<>();
        parameters.put("USERNAME", email);
        parameters.put("PASSWORD", password);
        if (properties.hasClientSecret()) {
            parameters.put("SECRET_HASH", secretHash(email));
        }

        try {
            return client.initiateAuth(InitiateAuthRequest.builder()
                    .clientId(properties.getClientId())
                    .authFlow(AuthFlowType.USER_PASSWORD_AUTH)
                    .authParameters(parameters)
                    .build());
        } catch (SdkException ex) {
            throw exceptions.translate(ex, email);
        }
    }

    private String secretHash(String username) {
        if (!properties.hasClientSecret()) {
            throw new IdentityProviderUnavailableException("Cognito client secret is not configured");
        }
        return SecretHash.calculate(properties.getClientSecret(), properties.getClientId(), username);
    }

    private String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }
}
