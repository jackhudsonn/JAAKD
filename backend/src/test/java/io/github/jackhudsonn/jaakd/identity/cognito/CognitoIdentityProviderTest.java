package io.github.jackhudsonn.jaakd.identity.cognito;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import io.github.jackhudsonn.jaakd.config.CognitoProperties;
import io.github.jackhudsonn.jaakd.exception.EmailAlreadyRegisteredException;
import io.github.jackhudsonn.jaakd.exception.EmailNotConfirmedException;
import io.github.jackhudsonn.jaakd.exception.UnauthorizedException;
import io.github.jackhudsonn.jaakd.identity.RegistrationOutcome;
import io.github.jackhudsonn.jaakd.identity.SignInOutcome;
import io.github.jackhudsonn.jaakd.identity.cognito.CognitoIdTokenVerifier.CognitoIdentity;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AuthenticationResultType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AuthFlowType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ChangePasswordRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ConfirmSignUpRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ConfirmSignUpResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.InitiateAuthRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.InitiateAuthResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.NotAuthorizedException;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ResendConfirmationCodeRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ResendConfirmationCodeResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.RevokeTokenRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.SignUpRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.SignUpResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.UserNotConfirmedException;

@ExtendWith(MockitoExtension.class)
class CognitoIdentityProviderTest {

    private static final UUID USER_ID = UUID.randomUUID();
    private static final String EMAIL = "joanna@example.com";

    @Mock
    private CognitoIdentityProviderClient client;

    @Mock
    private CognitoIdTokenVerifier verifier;

    @Mock
    private CognitoUserStore userStore;

    private CognitoProperties properties;
    private CognitoIdentityProvider provider;

    @BeforeEach
    void setUp() {
        properties = new CognitoProperties();
        properties.setRegion("eu-west-2");
        properties.setUserPoolId("pool");
        properties.setClientId("client");
        properties.setClientSecret("secret");

        provider = new CognitoIdentityProvider(client, properties, verifier, userStore,
                new CognitoExceptionTranslator());
    }

    @Test
    void register_returnsProviderSubjectAndConfirmationRequirement() {
        when(client.signUp(any(SignUpRequest.class)))
                .thenReturn(SignUpResponse.builder().userSub("subject").userConfirmed(false).build());

        RegistrationOutcome outcome = provider.register(USER_ID, EMAIL, "Password123!");

        assertEquals("subject", outcome.subject());
        assertEquals(true, outcome.confirmationRequired());
        assertNull(outcome.signUpSession());

        ArgumentCaptor<SignUpRequest> request = ArgumentCaptor.forClass(SignUpRequest.class);
        verify(client).signUp(request.capture());
        assertEquals("client", request.getValue().clientId());
        assertEquals(USER_ID.toString(), request.getValue().username());
        assertEquals("email", request.getValue().userAttributes().getFirst().name());
    }

    @Test
    void register_rejectsAnAlreadyConfirmedEmail() {
        when(userStore.findConfirmedByEmail(EMAIL))
                .thenReturn(Optional.of(cognitoUser(CognitoUserStatus.CONFIRMED)));

        assertThrows(EmailAlreadyRegisteredException.class,
                () -> provider.register(USER_ID, EMAIL, "Password123!"));

        verify(client, never()).signUp(any(SignUpRequest.class));
    }

    @Test
    void confirmRegistration_confirmsCognitoThenMarksTheLink() {
        CognitoUser pending = cognitoUser(CognitoUserStatus.PENDING);
        when(userStore.findByUserId(USER_ID)).thenReturn(Optional.of(pending));
        when(client.confirmSignUp(any(ConfirmSignUpRequest.class)))
                .thenReturn(ConfirmSignUpResponse.builder().build());

        assertTrue(provider.confirmRegistration(USER_ID, "123456").isEmpty());

        ArgumentCaptor<ConfirmSignUpRequest> request = ArgumentCaptor.forClass(ConfirmSignUpRequest.class);
        verify(client).confirmSignUp(request.capture());
        assertEquals(USER_ID.toString(), request.getValue().username());
        assertEquals(Boolean.TRUE, request.getValue().forceAliasCreation());
        verify(userStore).markConfirmed(pending.getIdentityId());
    }

    @Test
    void confirmRegistration_retriesWithoutAnExpiredSignUpSession() {
        CognitoUser pending = cognitoUser(CognitoUserStatus.PENDING);
        when(userStore.findByUserId(USER_ID)).thenReturn(Optional.of(pending));
        when(client.confirmSignUp(any(ConfirmSignUpRequest.class)))
                .thenThrow(NotAuthorizedException.builder().message("expired session").build())
                .thenReturn(ConfirmSignUpResponse.builder().build());

        assertTrue(provider.confirmRegistration(USER_ID, "123456").isEmpty());

        ArgumentCaptor<ConfirmSignUpRequest> request = ArgumentCaptor.forClass(ConfirmSignUpRequest.class);
        verify(client, times(2)).confirmSignUp(request.capture());
        assertEquals("sign-up-session", request.getAllValues().get(0).session());
        assertNull(request.getAllValues().get(1).session());
        verify(userStore).markConfirmed(pending.getIdentityId());
    }

    @Test
    void confirmRegistration_usesTheConfirmationSessionToSignIn() {
        CognitoUser pending = cognitoUser(CognitoUserStatus.PENDING);
        when(userStore.findByUserId(USER_ID)).thenReturn(Optional.of(pending));
        when(client.confirmSignUp(any(ConfirmSignUpRequest.class)))
                .thenReturn(ConfirmSignUpResponse.builder().session("confirm-session").build());
        when(client.initiateAuth(any(InitiateAuthRequest.class))).thenReturn(
                InitiateAuthResponse.builder()
                        .authenticationResult(AuthenticationResultType.builder()
                                .idToken("id-token")
                                .refreshToken("refresh-token")
                                .build())
                        .build());
        when(verifier.verify("id-token")).thenReturn(new CognitoIdentity("subject", EMAIL));
        when(userStore.findBySubject("subject"))
                .thenReturn(Optional.of(cognitoUser(CognitoUserStatus.CONFIRMED)));

        Optional<SignInOutcome.Authenticated> result = provider.confirmRegistration(USER_ID, "123456");

        assertTrue(result.isPresent());
        assertEquals(USER_ID, result.orElseThrow().userId());
        assertEquals("refresh-token", result.orElseThrow().refreshToken());
        ArgumentCaptor<InitiateAuthRequest> request = ArgumentCaptor.forClass(InitiateAuthRequest.class);
        verify(client).initiateAuth(request.capture());
        assertEquals(AuthFlowType.USER_AUTH, request.getValue().authFlow());
        assertEquals("confirm-session", request.getValue().session());
        assertEquals(USER_ID.toString(), request.getValue().authParameters().get("USERNAME"));
    }

    @Test
    void resendConfirmation_usesTheRegistrationIdAsTheUsername() {
        CognitoUser pending = cognitoUser(CognitoUserStatus.PENDING);
        when(userStore.findByUserId(USER_ID)).thenReturn(Optional.of(pending));
        when(client.resendConfirmationCode(any(ResendConfirmationCodeRequest.class)))
                .thenReturn(ResendConfirmationCodeResponse.builder().build());

        provider.resendConfirmation(USER_ID);

        ArgumentCaptor<ResendConfirmationCodeRequest> request = ArgumentCaptor
                .forClass(ResendConfirmationCodeRequest.class);
        verify(client).resendConfirmationCode(request.capture());
        assertEquals(USER_ID.toString(), request.getValue().username());
    }

    @Test
    void signIn_verifiesIdTokenAndReturnsApplicationUserAndRefreshToken() {
        when(client.initiateAuth(any(InitiateAuthRequest.class))).thenReturn(
                InitiateAuthResponse.builder()
                        .authenticationResult(AuthenticationResultType.builder()
                                .idToken("id-token")
                                .refreshToken("refresh-token")
                                .build())
                        .build());
        when(verifier.verify("id-token")).thenReturn(new CognitoIdentity("subject", EMAIL));
        when(userStore.findBySubject("subject"))
                .thenReturn(Optional.of(cognitoUser(CognitoUserStatus.CONFIRMED)));

        SignInOutcome.Authenticated result = (SignInOutcome.Authenticated) provider.signIn(EMAIL,
                "Password123!");

        assertEquals(USER_ID, result.userId());
        assertEquals(EMAIL, result.email());
        assertEquals("refresh-token", result.refreshToken());
        verify(userStore).markConfirmed("subject");
    }

    @Test
    void signIn_mapsUnconfirmedProviderError() {
        when(client.initiateAuth(any(InitiateAuthRequest.class)))
                .thenThrow(UserNotConfirmedException.builder().message("unconfirmed").build());

        assertThrows(EmailNotConfirmedException.class,
                () -> provider.signIn(EMAIL, "Password123!"));
    }

    @Test
    void signIn_mapsPendingOnlyFailureToEmailNotConfirmed() {
        when(client.initiateAuth(any(InitiateAuthRequest.class)))
                .thenThrow(NotAuthorizedException.builder().message("not authorized").build());
        when(userStore.findLatestPendingByEmail(EMAIL))
                .thenReturn(Optional.of(cognitoUser(CognitoUserStatus.PENDING)));

        assertThrows(EmailNotConfirmedException.class,
                () -> provider.signIn(EMAIL, "Password123!"));
    }

    @Test
    void signIn_preservesUnauthorizedForConfirmedAccountsWithAWrongPassword() {
        when(client.initiateAuth(any(InitiateAuthRequest.class)))
                .thenThrow(NotAuthorizedException.builder().message("not authorized").build());
        when(userStore.findConfirmedByEmail(EMAIL))
                .thenReturn(Optional.of(cognitoUser(CognitoUserStatus.CONFIRMED)));

        assertThrows(UnauthorizedException.class,
                () -> provider.signIn(EMAIL, "wrong-password"));
    }

    @Test
    void changePassword_revokesTheTemporaryRefreshToken() {
        when(client.initiateAuth(any(InitiateAuthRequest.class))).thenReturn(
                InitiateAuthResponse.builder()
                        .authenticationResult(AuthenticationResultType.builder()
                                .accessToken("access-token")
                                .refreshToken("temporary-refresh")
                                .build())
                        .build());
        when(client.changePassword(any(ChangePasswordRequest.class))).thenReturn(null);

        provider.changePassword(EMAIL, "old-password", "new-password");

        verify(client).changePassword(any(ChangePasswordRequest.class));
        verify(client).revokeToken(any(RevokeTokenRequest.class));
    }

    private CognitoUser cognitoUser(CognitoUserStatus status) {
        return new CognitoUser(UUID.randomUUID(), USER_ID, "subject", status, "sign-up-session",
                java.time.Instant.now(), null);
    }
}
