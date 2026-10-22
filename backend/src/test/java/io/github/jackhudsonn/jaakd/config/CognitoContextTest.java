package io.github.jackhudsonn.jaakd.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import io.github.jackhudsonn.jaakd.BackendApplication;
import io.github.jackhudsonn.jaakd.identity.cognito.CognitoUserStore;

// Verifies the Cognito conditional beans wire without AWS calls at startup.
@SpringBootTest(classes = BackendApplication.class)
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "identity.provider=cognito",
        "identity.cognito.region=eu-west-2",
        "identity.cognito.user-pool-id=eu-west-2_example",
        "identity.cognito.client-id=client",
        "identity.cognito.client-secret=secret"
})
class CognitoContextTest {

    @Autowired
    private CognitoUserStore userStore;

    @Test
    void cognitoBeansWireAndRepositoryQueriesRun() {
        assertTrue(userStore.findConfirmedByEmail("nobody@example.com").isEmpty());
        assertTrue(userStore.findByUserId(UUID.randomUUID()).isEmpty());
    }
}
