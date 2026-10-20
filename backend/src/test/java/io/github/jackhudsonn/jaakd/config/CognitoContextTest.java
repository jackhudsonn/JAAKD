package io.github.jackhudsonn.jaakd.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import io.github.jackhudsonn.jaakd.BackendApplication;

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

    @Test
    void contextLoads() {
    }
}
