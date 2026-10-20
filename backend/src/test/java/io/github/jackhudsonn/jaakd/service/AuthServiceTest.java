package io.github.jackhudsonn.jaakd.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import io.github.jackhudsonn.jaakd.dto.CreateProfileRequest;
import io.github.jackhudsonn.jaakd.exception.ChallengeRequiredException;
import io.github.jackhudsonn.jaakd.exception.UnauthorizedException;
import io.github.jackhudsonn.jaakd.identity.IdentityProvider;
import io.github.jackhudsonn.jaakd.identity.RegistrationOutcome;
import io.github.jackhudsonn.jaakd.identity.SignInOutcome;
import io.github.jackhudsonn.jaakd.model.Session;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID SESSION_ID = UUID.randomUUID();
    private static final String EMAIL = "joanna@example.com";

    @Mock
    private IdentityProvider identityProvider;

    @Mock
    private UserProvisioner userProvisioner;

    @Mock
    private SessionService sessionService;

    @Mock
    private RegistrationService registrationService;

    private AuthService authService() {
        return new AuthService(identityProvider, userProvisioner, sessionService, registrationService);
    }

    @Test
    void register_persistsProviderOutcomeAndApplicationRows() {
        CreateProfileRequest profile = new CreateProfileRequest("Joanna", "Smith", null, "Boston", "MA", "USA",
                "02110");
        when(identityProvider.register(any(), any(), any()))
                .thenReturn(new RegistrationOutcome("subject", true));

        RegistrationResult result = authService().register(EMAIL, "Password123!", profile);

        assertEquals(EMAIL, result.email());
        assertEquals(true, result.confirmationRequired());
        verify(registrationService).persistRegistration(any(), any(), any(), any());
    }

    @Test
    void signIn_provisionsUserAndStartsSessionWithProviderRefreshToken() {
        when(identityProvider.signIn(EMAIL, "Password123!"))
                .thenReturn(new SignInOutcome.Authenticated(USER_ID, EMAIL, "refresh-token"));
        Session session = new Session(USER_ID, "refresh-token", Instant.now(), Instant.now().plusSeconds(3600));
        when(sessionService.create(USER_ID, "refresh-token")).thenReturn(session);

        SignInResult result = authService().signIn(EMAIL, "Password123!");

        verify(userProvisioner).ensureUser(USER_ID, EMAIL);
        assertEquals(session, result.session());
    }

    @Test
    void signIn_rejectsBadCredentialsWithoutProvisioning() {
        when(identityProvider.signIn(EMAIL, "wrong-password"))
                .thenThrow(new UnauthorizedException("invalid email or password"));

        assertThrows(UnauthorizedException.class, () -> authService().signIn(EMAIL, "wrong-password"));
        verify(userProvisioner, never()).ensureUser(any(), any());
    }

    @Test
    void signIn_relaysProviderChallenge() {
        when(identityProvider.signIn(EMAIL, "Password123!"))
                .thenReturn(new SignInOutcome.Challenge("opaque", "MFA"));

        ChallengeRequiredException ex = assertThrows(ChallengeRequiredException.class,
                () -> authService().signIn(EMAIL, "Password123!"));

        assertEquals("MFA", ex.getType());
        assertEquals("opaque", ex.getContinuation());
        verify(sessionService, never()).create(any(), any());
    }

    @Test
    void changePassword_revokesOtherProviderTokensAndSessions() {
        Session other = new Session(USER_ID, "other-refresh", Instant.now(), Instant.now().plusSeconds(3600));
        when(sessionService.findOtherSessions(USER_ID, SESSION_ID)).thenReturn(List.of(other));

        authService().changePassword(USER_ID, SESSION_ID, EMAIL, "old-password", "new-password");

        verify(identityProvider).changePassword(EMAIL, "old-password", "new-password");
        verify(identityProvider).revoke("other-refresh");
        verify(sessionService).revokeOtherSessions(USER_ID, SESSION_ID);
    }

    @Test
    void changePassword_doesNotRevokeWhenTheProviderRejects() {
        org.mockito.Mockito.doThrow(new UnauthorizedException("invalid email or password"))
                .when(identityProvider).changePassword(EMAIL, "wrong-password", "new-password");

        assertThrows(UnauthorizedException.class,
                () -> authService().changePassword(USER_ID, SESSION_ID, EMAIL, "wrong-password", "new-password"));

        verify(sessionService, never()).revokeOtherSessions(any(), any());
    }

    @Test
    void signOut_revokesTheSessionsRefreshTokenThenDeletesIt() {
        Session session = new Session(USER_ID, "refresh-token", Instant.now(), Instant.now().plusSeconds(3600));
        when(sessionService.find(SESSION_ID)).thenReturn(Optional.of(session));

        authService().signOut(SESSION_ID);

        verify(identityProvider).revoke("refresh-token");
        verify(sessionService).delete(SESSION_ID);
    }

    @Test
    void signOut_doesNothingForUnknownSession() {
        when(sessionService.find(SESSION_ID)).thenReturn(Optional.empty());

        authService().signOut(SESSION_ID);

        verify(identityProvider, never()).revoke(any());
        verify(sessionService, never()).delete(any());
    }
}
