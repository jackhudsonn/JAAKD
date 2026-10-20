package io.github.jackhudsonn.jaakd.config;

import java.net.URI;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;

import software.amazon.awssdk.auth.credentials.AnonymousCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.core.retry.RetryPolicy;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;

// The Cognito adapter talks to user-pool APIs, which are unsigned; anonymous
// credentials avoid the default provider chain probing IMDS for nothing.
@Configuration
@ConditionalOnProperty(name = "identity.provider", havingValue = "cognito")
@EnableConfigurationProperties(CognitoProperties.class)
public class CognitoClientConfig {

    @Bean(destroyMethod = "close")
    public CognitoIdentityProviderClient cognitoIdentityProviderClient(CognitoProperties properties) {
        ClientOverrideConfiguration override = ClientOverrideConfiguration.builder()
                .apiCallTimeout(properties.getApiCallTimeout())
                .apiCallAttemptTimeout(properties.getApiCallAttemptTimeout())
                .retryPolicy(RetryPolicy.builder().numRetries(2).build())
                .build();

        var builder = CognitoIdentityProviderClient.builder()
                .region(Region.of(properties.getRegion()))
                .credentialsProvider(AnonymousCredentialsProvider.create())
                .overrideConfiguration(override);

        if (properties.getEndpointOverride() != null && !properties.getEndpointOverride().isBlank()) {
            builder.endpointOverride(URI.create(properties.getEndpointOverride()));
        }

        return builder.build();
    }

    @Bean
    public JwtDecoder cognitoJwtDecoder(CognitoProperties properties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(properties.jwkSetUri()).build();
        OAuth2TokenValidator<Jwt> validators = new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(properties.issuer()));
        decoder.setJwtValidator(validators);
        return decoder;
    }
}
